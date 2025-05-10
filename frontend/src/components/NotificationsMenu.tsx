import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useNotifications from '../hooks/UseNotifications';

const NotificationsMenu = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Cerrar menú al hacer clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('notifications-menu');
      if (menu && !menu.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Formatear fecha relativa
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return 'ahora mismo';
    } else if (diffMin < 60) {
      return `hace ${diffMin} min`;
    } else if (diffHour < 24) {
      return `hace ${diffHour} h`;
    } else if (diffDay < 7) {
      return `hace ${diffDay} días`;
    } else {
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
      });
    }
  };

  // Abrir página relevante de la notificación
  const handleNotificationClick = (notification: any) => {
    // Marcar como leída
    markAsRead(notification.id);

    // Navegar según el tipo
    if (notification.data?.documentId) {
      // Para comentarios, firmas, etc.
      navigate(`/documents/${notification.data.documentId}`);
    } else if (notification.type.startsWith('user_')) {
      // Para notificaciones relacionadas con el usuario
      navigate('/profile');
    } else {
      // Para otros tipos de notificaciones
      navigate('/dashboard');
    }

    // Cerrar menú
    setIsOpen(false);
  };

  return (
    <div className="relative" id="notifications-menu">
      {/* Botón de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1 text-gray-500 rounded-full hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Menú desplegable */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 overflow-hidden bg-white rounded-md shadow-lg w-80">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-sm font-semibold text-gray-700">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-center text-gray-500">
                No tienes notificaciones
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map(notification => (
                  <li
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${!notification.isRead ? 'bg-blue-50' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex">
                      {/* Icono según tipo */}
                      <div className="flex-shrink-0">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          notification.type.includes('comment') ? 'bg-blue-100 text-blue-500' :
                          notification.type.includes('signature') ? 'bg-green-100 text-green-500' :
                          notification.type.includes('share') ? 'bg-purple-100 text-purple-500' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {notification.type.includes('comment') ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                          ) : notification.type.includes('signature') ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                          ) : notification.type.includes('share') ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                      
                      {/* Contenido */}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                        <p className="text-xs text-gray-500">{notification.message}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(notification.createdAt)}</p>
                      </div>

                      {/* Indicador no leído */}
                      {!notification.isRead && (
                        <div className="flex-shrink-0 ml-auto">
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="p-2 text-center border-t">
              <button
                onClick={() => navigate('/notifications')}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Ver todas las notificaciones
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsMenu;