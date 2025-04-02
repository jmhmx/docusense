import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from './Button';
import useAuth from '../hooks/useAuth';


const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar si hay un usuario logueado
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
  }, []);

    const handleLogout = () => {
    logout();
    navigate('/login');
  };


  return (
    <nav className="bg-gray-800 text-white py-4 px-6 flex justify-between items-center">
      <div className="flex items-center">
        <Link to="/" className="text-xl font-bold">DocuSense</Link>
      </div>
      
      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <Link to="/dashboard" className="hover:text-gray-300">
              Dashboard
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-gray-300">{user.name}</span>
            <Button onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
              Cerrar Sesión
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-gray-300">
              Iniciar Sesión
            </Link>
            <Link to="/register">
              <Button>Registrarse</Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;