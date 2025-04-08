import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface AuditLog {
  id: string;
  action: string;
  userId: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  details?: Record<string, any>;
  user?: {
    name: string;
    email: string;
  };
}

interface ActivityLogProps {
  resourceId?: string;
  limit?: number;
  showTitle?: boolean;
  compact?: boolean;
}

const ActivityLog = ({ resourceId, limit = 10, showTitle = true, compact = false }: ActivityLogProps) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      
      try {
        let url = '/api/audit';
        
        if (resourceId) {
          url = `/api/audit/resource/${resourceId}`;
        }
        
        const response = await api.get(url, {
          params: { limit },
        });
        
        setLogs(response.data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching activity logs:', err);
        setError(err?.response?.data?.message || 'Error loading activity logs');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLogs();
  }, [resourceId, limit]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionLabel = (action: string) => {
    const actionMap: Record<string, string> = {
      document_view: 'Viewed document',
      document_download: 'Downloaded document',
      document_upload: 'Uploaded document',
      document_delete: 'Deleted document',
      document_update: 'Updated document',
      document_sign: 'Signed document',
      document_share: 'Shared document',
      document_encrypt: 'Encrypted document',
      signature_create: 'Created signature',
      signature_verify: 'Verified signature',
      user_login: 'User login',
      user_logout: 'User logout',
      auth_2fa_request: 'Requested 2FA code',
      auth_2fa_verify: 'Verified 2FA code',
    };
    
    return actionMap[action] || action;
  };

  const getActionIcon = (action: string) => {
    if (action.includes('download')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    } else if (action.includes('view')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    } else if (action.includes('sign')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      );
    } else if (action.includes('encrypt')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    } else if (action.includes('login') || action.includes('2fa')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      );
    } else if (action.includes('upload')) {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
        </svg>
      );
    }
    
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <svg className="w-8 h-8 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No activity logs found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden bg-white shadow sm:rounded-lg">
      {showTitle && (
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Activity Log
          </h3>
          <p className="max-w-2xl mt-1 text-sm text-gray-500">
            Recent activity and security events.
          </p>
        </div>
      )}
      
      <ul className="divide-y divide-gray-200">
        {logs.map((log) => (
          <li key={log.id} className={`${compact ? 'px-4 py-2' : 'px-4 py-4'}`}>
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-1">
                {getActionIcon(log.action)}
              </div>
              <div className="flex-1 ml-3">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium text-gray-900 ${compact ? '' : 'mb-1'}`}>
                    {getActionLabel(log.action)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(log.timestamp)}
                  </p>
                </div>
                
                {!compact && (
                  <>
                    {log.details?.title && (
                      <p className="text-sm text-gray-500">
                        {log.details.title}
                      </p>
                    )}
                    
                    <div className="flex items-center mt-1">
                      {log.user ? (
                        <span className="text-xs text-gray-500">
                          {log.user.name} ({log.user.email})
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {log.userId}
                        </span>
                      )}
                      
                      {log.ipAddress && (
                        <span className="ml-2 text-xs text-gray-400">
                          from {log.ipAddress}
                        </span>
                      )}
                    </div>
                  </>
                )}
                
                {compact && log.details?.title && (
                  <p className="text-xs text-gray-500">
                    {log.details.title}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActivityLog;