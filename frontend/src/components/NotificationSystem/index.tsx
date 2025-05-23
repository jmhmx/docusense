import React, { createContext, useContext, useState, useCallback } from 'react';

// Tipos de notificación
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Interfaz para una notificación
export interface Notification {
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
  error: (
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

  const error = useCallback(
    (message: string, title?: string, options?: Partial<Notification>) => {
      return addNotification({
        type: 'error',
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
    error,
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

// Importar componentes individuales
import NotificationContainer from './NotificationContainer';
import ConfirmModal from './ConfirmModal';
