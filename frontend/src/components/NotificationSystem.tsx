import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';

// Tipos de notificación
type NotificationType = 'success' | 'errorNotification' | 'warning' | 'info';

// Interfaz para una notificación
interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  onAction?: () => void;
  actionText?: string;
}

// Contexto para las notificaciones
interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  success: (
    message: string,
    title?: string,
    options?: Partial<Notification>,
  ) => string;
  errorNotification: (
    message: string,
    title?: string,
    options?: Partial<Notification>,
  ) => string;
  warning: (
    message: string,
    title?: string,
    options?: Partial<Notification>,
  ) => string;
  info: (
    message: string,
    title?: string,
    options?: Partial<Notification>,
  ) => string;
  confirm: (message: string, title?: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

// Hook para usar las notificaciones
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications debe ser usado dentro de NotificationProvider',
    );
  }
  return context;
};

// Componente individual de notificación
const NotificationItem: React.FC<{
  notification: Notification;
  onRemove: (id: string) => void;
}> = ({ notification, onRemove }) => {
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
      case 'errorNotification':
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

// Contenedor de notificaciones
const NotificationContainer: React.FC<{
  notifications: Notification[];
  onRemove: (id: string) => void;
}> = ({ notifications, onRemove }) => {
  if (notifications.length === 0) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center px-4 py-6 pointer-events-none sm:p-6 sm:items-start sm:justify-end'>
      <div className='flex flex-col items-center space-y-4 sm:items-end'>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
};

// Modal de confirmación
const ConfirmModal: React.FC<{
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto'>
      <div className='flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0'>
        <div
          className='fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75'
          onClick={onCancel}></div>

        <span className='hidden sm:inline-block sm:align-middle sm:h-screen'>
          &#8203;
        </span>

        <div className='inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full'>
          <div className='px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4'>
            <div className='sm:flex sm:items-start'>
              <div className='flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-yellow-100 rounded-full sm:mx-0 sm:h-10 sm:w-10'>
                <svg
                  className='w-6 h-6 text-yellow-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <div className='mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left'>
                <h3 className='text-lg font-medium leading-6 text-gray-900'>
                  {title || 'Confirmación'}
                </h3>
                <div className='mt-2'>
                  <p className='text-sm text-gray-500'>{message}</p>
                </div>
              </div>
            </div>
          </div>
          <div className='px-4 py-3 bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse'>
            <button
              onClick={onConfirm}
              className='inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm'>
              Confirmar
            </button>
            <button
              onClick={onCancel}
              className='inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm'>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Provider principal
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    resolve?: (value: boolean) => void;
  }>({ isOpen: false, message: '' });

  // Generar ID único para notificaciones
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }, []);

  // Agregar notificación
  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = generateId();
      const newNotification: Notification = {
        id,
        duration: 5000,
        persistent: false,
        ...notification,
      };

      setNotifications((prev) => [...prev, newNotification]);
      return id;
    },
    [generateId],
  );

  // Remover notificación
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Limpiar todas las notificaciones
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Métodos de conveniencia
  const success = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      return addNotification({ type: 'success', message, title, ...options });
    },
    [addNotification],
  );

  const errorNotification = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      return addNotification({
        type: 'errorNotification',
        message,
        title,
        persistent: true,
        ...options,
      });
    },
    [addNotification],
  );

  const warning = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      return addNotification({ type: 'warning', message, title, ...options });
    },
    [addNotification],
  );

  const info = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      return addNotification({ type: 'info', message, title, ...options });
    },
    [addNotification],
  );

  // Modal de confirmación
  const confirm = useCallback(
    (message: string, title?: string): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmModal({
          isOpen: true,
          title,
          message,
          resolve,
        });
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (confirmModal.resolve) {
      confirmModal.resolve(true);
    }
    setConfirmModal({ isOpen: false, message: '' });
  }, [confirmModal]);

  const handleCancel = useCallback(() => {
    if (confirmModal.resolve) {
      confirmModal.resolve(false);
    }
    setConfirmModal({ isOpen: false, message: '' });
  }, [confirmModal]);

  const contextValue: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    errorNotification,
    warning,
    info,
    confirm,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </NotificationContext.Provider>
  );
};
