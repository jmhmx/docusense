import React, { useEffect } from 'react';
import { Notification } from './index';

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRemove,
}) => {
  const { id, type, title, message, persistent, onAction, actionText } =
    notification;

  // Auto-remove después del tiempo especificado
  useEffect(() => {
    if (!persistent) {
      const timer = setTimeout(() => {
        onRemove(id);
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [id, persistent, notification.duration, onRemove]);

  // Configuración de estilos según el tipo
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-green-50 border-green-200',
          icon: 'text-green-400',
          title: 'text-green-800',
          message: 'text-green-700',
          button: 'text-green-600 hover:text-green-500',
          iconPath: (
            <path
              fillRule='evenodd'
              d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
              clipRule='evenodd'
            />
          ),
        };
      case 'error':
        return {
          container: 'bg-red-50 border-red-200',
          icon: 'text-red-400',
          title: 'text-red-800',
          message: 'text-red-700',
          button: 'text-red-600 hover:text-red-500',
          iconPath: (
            <path
              fillRule='evenodd'
              d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
              clipRule='evenodd'
            />
          ),
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border-yellow-200',
          icon: 'text-yellow-400',
          title: 'text-yellow-800',
          message: 'text-yellow-700',
          button: 'text-yellow-600 hover:text-yellow-500',
          iconPath: (
            <path
              fillRule='evenodd'
              d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
              clipRule='evenodd'
            />
          ),
        };
      case 'info':
      default:
        return {
          container: 'bg-blue-50 border-blue-200',
          icon: 'text-blue-400',
          title: 'text-blue-800',
          message: 'text-blue-700',
          button: 'text-blue-600 hover:text-blue-500',
          iconPath: (
            <path
              fillRule='evenodd'
              d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
              clipRule='evenodd'
            />
          ),
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div
      className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${styles.container}`}>
      <div className='p-4'>
        <div className='flex items-start'>
          <div className='flex-shrink-0'>
            <svg
              className={`h-6 w-6 ${styles.icon}`}
              fill='currentColor'
              viewBox='0 0 20 20'>
              {styles.iconPath}
            </svg>
          </div>
          <div className='flex-1 w-0 ml-3'>
            {title && (
              <p className={`text-sm font-medium ${styles.title}`}>{title}</p>
            )}
            <p className={`text-sm ${styles.message} ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
            {onAction && actionText && (
              <div className='mt-3'>
                <button
                  onClick={onAction}
                  className={`text-sm font-medium ${styles.button} focus:outline-none focus:underline`}>
                  {actionText}
                </button>
              </div>
            )}
          </div>
          <div className='flex flex-shrink-0 ml-4'>
            <button
              onClick={() => onRemove(id)}
              className={`rounded-md inline-flex ${styles.button} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500`}>
              <span className='sr-only'>Cerrar</span>
              <svg
                className='w-5 h-5'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                  clipRule='evenodd'
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
