import { useState, useEffect } from 'react';
import { api } from '../api/client';
import ActivityLog from '../components/ActivityLog';

interface SecurityStats {
  totalDocuments: number;
  encryptedDocuments: number;
  signedDocuments: number;
  securityScore: number;
  recentLogins: number;
  failedLogins: number;
  mostViewedDocument?: {
    id: string;
    title: string;
    views: number;
  };
  lastAuditDate?: string;
}

const SecurityDashboard = () => {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceSecurity, setDeviceSecurity] = useState<{enabled: boolean, lastVerified?: string} | null>(null);

  useEffect(() => {
    const fetchSecurityStats = async () => {
      setLoading(true);
      
      try {
        // In a real implementation, this would come from the backend
        // This is a mock implementation
        const response = await api.get('/api/security/stats');
        setStats(response.data);
        
        // Simulated response for demo
        setTimeout(() => {
          setStats({
            totalDocuments: 24,
            encryptedDocuments: 8,
            signedDocuments: 15,
            securityScore: 72,
            recentLogins: 5,
            failedLogins: 1,
            mostViewedDocument: {
              id: '123',
              title: 'Confidential Report.pdf',
              views: 12
            },
            lastAuditDate: new Date().toISOString()
          });
          setDeviceSecurity({
            enabled: true,
            lastVerified: new Date().toISOString()
          });
          setLoading(false);
        }, 500);
        
      } catch (err: any) {
        console.error('Error fetching security stats:', err);
        setError(err?.response?.data?.message || 'Error loading security information');
        setLoading(false);
      }
    };
    
    fetchSecurityStats();
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreMessage = (score: number) => {
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Needs improvement';
    return 'At risk';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="w-10 h-10 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-md bg-red-50">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading security information</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-4 py-5 bg-white shadow sm:rounded-lg sm:p-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Security Dashboard
            </h2>
          </div>
          <div className="flex mt-4 md:mt-0 md:ml-4">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 ml-3 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Security Audit
            </button>
          </div>
        </div>
      </div>

      {/* Security Score Card */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Security Score
          </h3>
          <div className="mt-5">
            <div className="flex items-center">
              <div className="flex-1">
                <div className="relative pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${
                        stats.securityScore >= 80 ? 'bg-green-200 text-green-800' : 
                        stats.securityScore >= 60 ? 'bg-yellow-200 text-yellow-800' : 
                        'bg-red-200 text-red-800'
                      }`}>
                        {getScoreMessage(stats.securityScore)}
                      </span>
                    </div>
                    <div className={`text-right ${getScoreColor(stats.securityScore)}`}>
                      <span className="inline-block text-xs font-semibold">
                        {stats.securityScore}/100
                      </span>
                    </div>
                  </div>
                  <div className="flex h-2 mb-4 overflow-hidden text-xs bg-gray-200 rounded">
                    <div 
                      style={{ width: `${stats.securityScore}%` }} 
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        stats.securityScore >= 80 ? 'bg-green-500' : 
                        stats.securityScore >= 60 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Document Encryption Stats */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-blue-100 rounded-md">
                <svg className="w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1 w-0 ml-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Encrypted Documents
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.encryptedDocuments} / {stats.totalDocuments}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="px-4 py-4 bg-gray-50 sm:px-6">
            <div className="text-sm">
              <span className="font-medium text-blue-600 hover:text-blue-500">
                {Math.round((stats.encryptedDocuments / stats.totalDocuments) * 100)}% of documents are encrypted
              </span>
            </div>
          </div>
        </div>

        {/* Document Signatures Stats */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-green-100 rounded-md">
                <svg className="w-6 h-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <div className="flex-1 w-0 ml-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Signed Documents
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.signedDocuments} / {stats.totalDocuments}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="px-4 py-4 bg-gray-50 sm:px-6">
            <div className="text-sm">
              <span className="font-medium text-green-600 hover:text-green-500">
                {Math.round((stats.signedDocuments / stats.totalDocuments) * 100)}% of documents are signed
              </span>
            </div>
          </div>
        </div>

        {/* Authentication Stats */}
        <div className="overflow-hidden bg-white rounded-lg shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 p-3 bg-yellow-100 rounded-md">
                <svg className="w-6 h-6 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="flex-1 w-0 ml-5">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Recent Authentication
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.recentLogins} logins, {stats.failedLogins} failed
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="px-4 py-4 bg-gray-50 sm:px-6">
            <div className="text-sm">
              <span className={`font-medium ${stats.failedLogins > 0 ? 'text-yellow-600 hover:text-yellow-500' : 'text-green-600 hover:text-green-500'}`}>
                {stats.failedLogins > 0 ? 'Failed login attempts detected' : 'No suspicious login attempts'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Device Security */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Device Security
          </h3>
          <div className="max-w-xl mt-2 text-sm text-gray-500">
            <p>
              Two-factor authentication adds an extra layer of security to your account.
            </p>
          </div>
          <div className="mt-5">
            <div className="px-6 py-5 rounded-md bg-gray-50 sm:flex sm:items-start sm:justify-between">
              <div className="sm:flex sm:items-center">
                <svg className="w-8 h-8 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="mt-3 sm:mt-0 sm:ml-4">
                  <div className="text-sm font-medium text-gray-900">
                    Two-factor authentication
                  </div>
                  <div className="mt-1 text-sm text-gray-600 sm:flex sm:items-center">
                    <div>
                      {deviceSecurity?.enabled ? 'Enabled' : 'Not enabled'}
                    </div>
                    {deviceSecurity?.lastVerified && (
                      <span className="hidden sm:mx-2 sm:inline" aria-hidden="true">
                        &middot;
                      </span>
                    )}
                    {deviceSecurity?.lastVerified && (
                      <div>
                        Last verified: {new Date(deviceSecurity.lastVerified).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 sm:mt-0 sm:ml-6 sm:flex-shrink-0">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                >
                  {deviceSecurity?.enabled ? 'Configure' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Recent Security Activity
          </h3>
          <p className="max-w-2xl mt-1 text-sm text-gray-500">
            Recent security events and document access logs.
          </p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <ActivityLog limit={5} showTitle={false} />
        </div>
      </div>

      {/* Security Recommendations */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Security Recommendations
          </h3>
          <div className="max-w-xl mt-2 text-sm text-gray-500">
            <p>
              Based on your account activity, here are some recommendations to improve your security.
            </p>
          </div>
          <div className="mt-5">
            <div className="space-y-4">
              {stats.encryptedDocuments / stats.totalDocuments < 0.5 && (
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Encrypt more documents</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Less than half of your documents are encrypted. Consider encrypting sensitive documents.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {stats.signedDocuments / stats.totalDocuments < 0.75 && (
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Sign your documents</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Consider signing important documents to ensure their integrity.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {stats.failedLogins > 0 && (
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Review login activity</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        There have been failed login attempts. Review your account activity.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!deviceSecurity?.enabled && (
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5a12.175 12.175 0 000 10.2A11.954 11.954 0 0110 18.099a11.954 11.954 0 017.834-2.899 12.175 12.175 0 000-10.2A11.954 11.954 0 0110 1.944zM8 14h4v-2H8v2zM8 8h4V6H8v2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Enable two-factor authentication</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        Two-factor authentication is not enabled. Enable it for additional security.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;