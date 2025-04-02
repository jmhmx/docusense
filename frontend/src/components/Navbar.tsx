import { useNavigate, Link } from 'react-router-dom';
import Button from './Button';
import useAuth from '../hooks/UseAuth';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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