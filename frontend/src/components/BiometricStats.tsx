import { useState, useEffect } from 'react';
import { api } from '../api/client';

const BiometricStats = () => {
  const [stats, setStats] = useState({
    totalSuccessful: 0,
    totalFailed: 0,
    averageScore: 0,
    lastVerification: null,
    registrationDate: null,
    securityLevel: 'standard'
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchBiometricStats = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/api/biometry/stats');
        setStats(response.data);
      } catch (err) {
        console.error('Error fetching biometric stats:', err);
        setError('Could not load biometric authentication statistics');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBiometricStats();
  }, []);
  
  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex justify-center">
          <svg className="w-8 h-8 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="p-4 rounded-md bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900">Biometric Authentication Statistics</h3>
      
      <div className="grid grid-cols-1 gap-5 mt-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="px-4 py-5 overflow-hidden bg-white rounded-lg shadow sm:p-6">
          <dt className="text-sm font-medium text-gray-500 truncate">Successful Verifications</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalSuccessful}</dd>
        </div>
        
        <div className="px-4 py-5 overflow-hidden bg-white rounded-lg shadow sm:p-6">
          <dt className="text-sm font-medium text-gray-500 truncate">Failed Attempts</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalFailed}</dd>
        </div>
        
        <div className="px-4 py-5 overflow-hidden bg-white rounded-lg shadow sm:p-6">
          <dt className="text-sm font-medium text-gray-500 truncate">Average Score</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.averageScore.toFixed(2)}</dd>
        </div>
      </div>
      
      <div className="mt-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Last Verification</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(stats.lastVerification)}</dd>
          </div>
          
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Registration Date</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(stats.registrationDate)}</dd>
          </div>
          
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Security Level</dt>
            <dd className="mt-1 text-sm text-gray-900">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                stats.securityLevel === 'high' 
                  ? 'bg-green-100 text-green-800'
                  : stats.securityLevel === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-blue-100 text-blue-800'
              }`}>
                {stats.securityLevel.charAt(0).toUpperCase() + stats.securityLevel.slice(1)}
              </span>
            </dd>
          </div>
        </dl>
      </div>
      
      <div className="p-4 mt-6 rounded-md bg-blue-50">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Information</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Biometric data is securely stored and processed in compliance with data protection regulations.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiometricStats;