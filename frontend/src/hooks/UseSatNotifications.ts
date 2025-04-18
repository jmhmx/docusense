// frontend/src/hooks/useSatNotifications.ts
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import useAuth from './UseAuth';

type Notification = {
  type: string;
  title: string;
  message: string;
  data: any;
  time: string;
};

type NotificationCallback = (notification: Notification) => void;

const useSatNotifications = () => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [callbacks, setCallbacks] = useState<NotificationCallback[]>([]);

  useEffect(() => {
    // Inicializar la conexión de socket solo si hay un usuario autenticado
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token');
      const socketInstance = io(import.meta.env.VITE_API_URL, {
        auth: { token },
        transports: ['websocket'],
      });

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

        // Ejecutar callbacks registrados
        callbacks.forEach((callback) => {
          try {
            callback(notification);
          } catch (error) {
            console.error('Error en callback de notificación:', error);
          }
        });

        // Si es una notificación del SAT, mostrar notificación del navegador
        if (notification.type.startsWith('SAT_')) {
          showBrowserNotification(notification);
        }
      });

      setSocket(socketInstance);

      // Cleanup al desmontar
      return () => {
        socketInstance.disconnect();
        setSocket(null);
        setConnected(false);
      };
    }
  }, [isAuthenticated, user]);

  // Función para mostrar notificación del navegador
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

  // Registrar un callback para notificaciones
  const registerCallback = (callback: NotificationCallback) => {
    setCallbacks((prev) => [...prev, callback]);
    return () => {
      setCallbacks((prev) => prev.filter((cb) => cb !== callback));
    };
  };

  // Suscribirse a un tema específico
  const subscribeTopic = (topic: string) => {
    if (socket && connected) {
      socket.emit('subscribe', { topic });
    }
  };

  // Desuscribirse de un tema
  const unsubscribeTopic = (topic: string) => {
    if (socket && connected) {
      socket.emit('unsubscribe', { topic });
    }
  };

  return {
    connected,
    notifications,
    registerCallback,
    subscribeTopic,
    unsubscribeTopic,
  };
};

export default useSatNotifications;
