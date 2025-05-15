// frontend/src/components/AdminRoute.tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Mientras se carga, no mostrar nada
  if (isLoading) {
    return null;
  }

  // Si no está autenticado, redirigir a login
  if (!isAuthenticated) {
    return (
      <Navigate
        to='/login'
        replace
      />
    );
  }

  // Si está autenticado pero no es administrador, redirigir a dashboard
  if (!user?.isAdmin) {
    return (
      <Navigate
        to='/dashboard'
        replace
      />
    );
  }

  // Si es administrador, mostrar el componente
  return <>{children}</>;
};

export default AdminRoute;
