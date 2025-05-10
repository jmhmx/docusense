// frontend/src/hooks/useNotifications.ts
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import useAuth from './UseAuth';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
};

type NotificationCallback = (notification: Notification) => void;

const useNotifications = () => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [callbacks, setCallbacks] = useState<NotificationCallback[]>([]);

  // Conectar al WebSocket cuando el usuario está autenticado
  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token');
      const socketInstance = io(
        import.meta.env.VITE_API_URL || 'http://localhost:3000',
        {
          auth: {
            token, // Token de autenticación
          },
          transports: ['websocket'],
        },
      );

      socketInstance.on('connect', () => {
        console.log('Conexión WebSocket establecida');
        setConnected(true);
      });

      socketInstance.on('disconnect', () => {
        console.log('Conexión WebSocket desconectada');
        setConnected(false);
      });

      socketInstance.on('notification', (notification: Notification) => {
        // Añadir a la lista de notificaciones
        setNotifications((prev) => [notification, ...prev]);

        // Actualizar contador de no leídas
        if (!notification.isRead) {
          setUnreadCount((prev) => prev + 1);
        }

        // Ejecutar callbacks registrados
        callbacks.forEach((callback) => {
          try {
            callback(notification);
          } catch (error) {
            console.error('Error en callback de notificación:', error);
          }
        });

        // Mostrar notificación del navegador para comentarios
        if (notification.type === 'comment_mention') {
          showBrowserNotification(notification);
        }
      });

      setSocket(socketInstance);

      // Cargar notificaciones existentes
      fetchNotifications();

      // Limpieza al desmontar
      return () => {
        socketInstance.disconnect();
        setSocket(null);
        setConnected(false);
      };
    }
  }, [isAuthenticated, user]);

  // Cargar notificaciones desde el backend
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      const { api } = await import('../api/client');
      const response = await api.get('/api/notifications');
      setNotifications(response.data);

      // Calcular no leídas
      const unread = response.data.filter(
        (n: Notification) => !n.isRead,
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error al cargar notificaciones:', error);
    }
  }, [isAuthenticated, user]);

  // Mostrar notificación del navegador
  const showBrowserNotification = (notification: Notification) => {
    if (!('Notification' in window)) {
      console.log('Este navegador no soporta notificaciones de escritorio');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/logo.png',
          });
        }
      });
    }
  };

  // Marcar notificación como leída
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!isAuthenticated || !user) return;

      try {
        const { api } = await import('../api/client');
        await api.patch(`/api/notifications/${notificationId}/read`);

        // Actualizar estado local
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n,
          ),
        );

        // Actualizar contador
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Error al marcar notificación como leída:', error);
      }
    },
    [isAuthenticated, user],
  );

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      const { api } = await import('../api/client');
      await api.post('/api/notifications/read-all');

      // Actualizar estado local
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

      // Resetear contador
      setUnreadCount(0);
    } catch (error) {
      console.error(
        'Error al marcar todas las notificaciones como leídas:',
        error,
      );
    }
  }, [isAuthenticated, user]);

  // Registrar un callback para recibir notificaciones
  const registerCallback = useCallback((callback: NotificationCallback) => {
    setCallbacks((prev) => [...prev, callback]);

    // Devolver función para desregistrar
    return () => {
      setCallbacks((prev) => prev.filter((cb) => cb !== callback));
    };
  }, []);

  // Suscribirse a un tema específico
  const subscribeTopic = useCallback(
    (topic: string) => {
      if (socket && connected) {
        socket.emit('subscribe', { topic });
      }
    },
    [socket, connected],
  );

  // Desuscribirse de un tema
  const unsubscribeTopic = useCallback(
    (topic: string) => {
      if (socket && connected) {
        socket.emit('unsubscribe', { topic });
      }
    },
    [socket, connected],
  );

  return {
    connected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    registerCallback,
    subscribeTopic,
    unsubscribeTopic,
    fetchNotifications,
  };
};

export default useNotifications;
