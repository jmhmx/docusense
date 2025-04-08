#!/bin/bash
# DocuSense - Security Testing Script
# Run this script to perform basic security testing on the application

echo "----------------------------------------"
echo "DocuSense Security Testing Tool"
echo "----------------------------------------"
echo "Running security checks..."
echo ""

# Set base URL - change as needed
BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Function to make API calls and check response
check_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3
  local description=$4
  local token=$5
  local data=$6

  echo -n "Testing $description... "
  
  # Set authorization header if token is provided
  auth_header=""
  if [ ! -z "$token" ]; then
    auth_header="-H \"Authorization: Bearer $token\""
  fi
  
  # Set data if provided
  data_param=""
  if [ ! -z "$data" ]; then
    data_param="-d '$data'"
  fi
  
  # Make the request and capture status code
  cmd="curl -s -o /dev/null -w \"%{http_code}\" $auth_header $data_param -X $method \"$endpoint\""
  status_code=$(eval $cmd)
  
  if [ "$status_code" == "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} [$status_code]"
    return 0
  else
    echo -e "${RED}FAIL${NC} [Expected: $expected_status, Got: $status_code]"
    return 1
  fi
}

# Function to test JWT token expiration
test_jwt_expiration() {
  echo -n "Testing JWT token expiration... "
  
  # Create an expired token (modify your actual token to expire)
  # This is a placeholder - in a real test, you would create an actual expired token
  expired_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJleHAiOjE2MTAwMDAwMDB9.invalid_signature"
  
  # Try to access a protected endpoint
  status_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $expired_token" \
    -X GET "$API_URL/documents")
  
  if [ "$status_code" == "401" ]; then
    echo -e "${GREEN}PASS${NC} [$status_code]"
    return 0
  else
    echo -e "${RED}FAIL${NC} [Expected: 401, Got: $status_code]"
    return 1
  fi
}

# Function to test brute force protection
test_brute_force_protection() {
  echo -n "Testing brute force protection... "
  
  # Make multiple login attempts
  local attempts=6
  local blocked=false
  
  for (( i=1; i<=$attempts; i++ )); do
    status_code=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -d '{"email":"nonexistent@example.com","password":"wrongpassword"}' \
      -X POST "$API_URL/auth/login")
    
    if [ "$status_code" == "429" ]; then
      blocked=true
      break
    fi
  done
  
  if [ "$blocked" = true ]; then
    echo -e "${GREEN}PASS${NC} [Rate limiting active]"
    return 0
  else
    echo -e "${YELLOW}WARNING${NC} [No rate limiting detected after $attempts attempts]"
    return 1
  fi
}

# Function to test CSRF protection
test_csrf_protection() {
  echo -n "Testing CSRF protection... "
  
  # Try to make a state-changing request without CSRF token
  status_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d '{"name":"test"}' \
    -X POST "$API_URL/users")
  
  # For proper CSRF protection, this should fail without a valid token
  # Note: The actual status code depends on your implementation (403 or 401)
  if [ "$status_code" == "401" ] || [ "$status_code" == "403" ]; then
    echo -e "${GREEN}PASS${NC} [$status_code]"
    return 0
  else
    echo -e "${YELLOW}WARNING${NC} [Expected: 401 or 403, Got: $status_code]"
    return 1
  fi
}

# Function to test XSS vulnerabilities
test_xss_vulnerability() {
  echo -n "Testing for XSS vulnerabilities... "
  
  # Create a payload with a script tag
  xss_payload="<script>alert('XSS')</script>"
  encoded_payload=$(echo -n "$xss_payload" | jq -sRr @uri)
  
  # Try to submit payload and check if it's sanitized
  response=$(curl -s \
    -H "Content-Type: application/json" \
    -d "{\"description\":\"$xss_payload\"}" \
    -X POST "$API_URL/documents")
  
  # If the payload is returned exactly as submitted, there might be an XSS vulnerability
  if echo "$response" | grep -q "$xss_payload"; then
    echo -e "${RED}FAIL${NC} [XSS payload not sanitized]"
    return 1
  else
    echo -e "${GREEN}PASS${NC} [Input appears to be sanitized]"
    return 0
  fi
}

# Function to test SQL injection vulnerabilities
test_sql_injection() {
  echo -n "Testing for SQL injection vulnerabilities... "
  
  # Try common SQL injection patterns
  status_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "$API_URL/users?id=1%20OR%201=1")
  
  # If it returns results when it shouldn't, might be vulnerable
  # This is a basic check - real tests would need to analyze the response content
  if [ "$status_code" == "400" ] || [ "$status_code" == "401" ] || [ "$status_code" == "422" ]; then
    echo -e "${GREEN}PASS${NC} [Injection attempt blocked]"
    return 0
  else
    echo -e "${YELLOW}WARNING${NC} [Response: $status_code - manual review recommended]"
    return 1
  fi
}

# Function to test file upload vulnerabilities
test_file_upload() {
  echo -n "Testing file upload restrictions... "
  
  # Create a "malicious" file
  echo "<?php echo 'Potential malicious code'; ?>" > /tmp/malicious.php
  
  # Try to upload it
  upload_response=$(curl -s \
    -F "file=@/tmp/malicious.php" \
    -X POST "$API_URL/documents")
  
  # Remove test file
  rm /tmp/malicious.php
  
  # Check if upload was rejected (response should indicate failure)
  if echo "$upload_response" | grep -q -i "error\|invalid\|rejected\|not allowed"; then
    echo -e "${GREEN}PASS${NC} [Suspicious file rejected]"
    return 0
  else
    echo -e "${YELLOW}WARNING${NC} [PHP file upload not explicitly blocked - review file validation]"
    return 1
  fi
}

# Function to test 2FA implementation
test_2fa() {
  echo -n "Testing 2FA bypass prevention... "
  
  # First, simulate getting a login token without 2FA
  token_response=$(curl -s \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"password123"}' \
    -X POST "$API_URL/auth/login")
  
  # Extract token (this is a simplified example)
  token=$(echo $token_response | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  
  # Now try to access a protected resource that should require 2FA
  status_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $token" \
    -X GET "$API_URL/documents/sensitive")
  
  # Should require additional 2FA verification
  if [ "$status_code" == "403" ] || [ "$status_code" == "401" ]; then
    echo -e "${GREEN}PASS${NC} [2FA enforcement working]"
    return 0
  else
    echo -e "${YELLOW}WARNING${NC} [Sensitive operation may not enforce 2FA]"
    return 1
  fi
}

# Function to test secure headers
test_secure_headers() {
  echo -n "Testing secure HTTP headers... "
  
  headers=$(curl -s -I "$BASE_URL" | grep -E 'X-Frame-Options|Content-Security-Policy|X-Content-Type-Options|Strict-Transport-Security')
  
  if [ -z "$headers" ]; then
    echo -e "${YELLOW}WARNING${NC} [Security headers not detected]"
    return 1
  else
    echo -e "${GREEN}PASS${NC} [Security headers present]"
    return 0
  fi
}

# Function to test encryption implementation
test_encryption() {
  echo -n "Testing document encryption... "
  
  # This is a placeholder for a more complex test
  # In a real test, you would:
  # 1. Upload a document
  # 2. Encrypt it
  # 3. Try to access the raw file and verify it's encrypted
  
  echo -e "${YELLOW}MANUAL CHECK REQUIRED${NC} [Manual verification of encryption needed]"
  return 0
}

# Function to check for sensitive information in responses
test_sensitive_info_exposure() {
  echo -n "Testing for sensitive information exposure... "
  
  # Make a request that should return user data
  response=$(curl -s \
    -X GET "$API_URL/users")
  
  # Check for sensitive patterns
  if echo "$response" | grep -q -i "password\|secret\|token\|key"; then
    echo -e "${RED}FAIL${NC} [Response may contain sensitive data]"
    return 1
  else
    echo -e "${GREEN}PASS${NC} [No obvious sensitive data exposed]"
    return 0
  fi
}

# Main test execution
echo "==== API Endpoint Security Tests ===="
check_endpoint "GET" "$API_URL/health" "200" "Health endpoint accessibility"
check_endpoint "GET" "$API_URL/documents" "401" "Unauthorized document access"
check_endpoint "POST" "$API_URL/auth/login" "400" "Login validation" "" '{"email":"", "password":""}'

echo ""
echo "==== Authentication & Authorization Tests ===="
test_jwt_expiration
test_brute_force_protection
test_csrf_protection
test_2fa

echo ""
echo "==== Input Validation & Sanitization Tests ===="
test_xss_vulnerability
test_sql_injection
test_file_upload

echo ""
echo "==== Data Protection Tests ===="
test_encryption
test_sensitive_info_exposure
test_secure_headers

echo ""
echo "----------------------------------------"
echo "Security testing completed!"
echo "----------------------------------------"
echo ""
echo "IMPORTANT NOTES:"
echo "1. This script provides basic security checks only."
echo "2. A comprehensive security audit should be performed by security professionals."
echo "3. Some tests require manual verification and further investigation."
echo "4. False positives and negatives are possible - follow up on warnings."
echo ""