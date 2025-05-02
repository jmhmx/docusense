// Completando el componente RecentActivityTimeline.tsx
import React from 'react';

interface Activity {
  id: string;
  action: string;
  user: {
    id: string;
    name: string;
  };
  resourceId: string;
  resourceType: string;
  resourceName: string;
  timestamp: string;
  details?: any;
}

interface RecentActivityTimelineProps {
  activities: Activity[];
}

const getActivityIcon = (action: string) => {
  switch (action) {
    case 'document_upload':
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
          <svg className="w-5 h-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
      );
    case 'document_view':
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
          <svg className="w-5 h-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
      );
    case 'document_sign':
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
          <svg className="w-5 h-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      );
    case 'document_encrypt':
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full">
          <svg className="w-5 h-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      );
    case 'document_share':
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-full">
          <svg className="w-5 h-5 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </div>
      );
    case 'document_delete':
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full">
          <svg className="w-5 h-5 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
          <svg className="w-5 h-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      );
  }
};

const RecentActivityTimeline = ({ activities }: RecentActivityTimelineProps) => {
  if (!activities || activities.length === 0) {
    return (
      <div className="py-6 text-center text-gray-500">
        No hay actividad reciente para mostrar.
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionText = (action: string): string => {
    switch(action) {
      case 'document_upload': return 'subió';
      case 'document_view': return 'visualizó';
      case 'document_sign': return 'firmó';
      case 'document_encrypt': return 'cifró';
      case 'document_share': return 'compartió';
      case 'document_delete': return 'eliminó';
      default: return 'interactuó con';
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, index) => (
          <li key={activity.id}>
            <div className="relative pb-8">
              {index < activities.length - 1 && (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
              )}
              <div className="relative flex space-x-3">
                <div>{getActivityIcon(activity.action)}</div>
                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-900">{activity.user.name}</span>
                      {" "}{getActionText(activity.action)}{" "}
                      <span className="font-medium text-gray-900">{activity.resourceName}</span>
                    </p>
                    {activity.details && (
                      <p className="mt-1 text-xs text-gray-500">
                        {typeof activity.details === 'string' 
                          ? activity.details 
                          : activity.details.message || JSON.stringify(activity.details)
                        }
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-right text-gray-500 whitespace-nowrap">
                    <time dateTime={activity.timestamp}>{formatDate(activity.timestamp)}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentActivityTimeline;