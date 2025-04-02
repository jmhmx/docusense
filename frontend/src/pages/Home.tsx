import { Link } from 'react-router-dom';
import Button from '../components/Button';
import useAuth from '../hooks/useAuth';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="max-w-4xl mx-auto text-center">
      <h1 className="text-4xl font-bold mb-6">Bienvenido a DocuSense</h1>
      <p className="text-xl mb-8">
        La plataforma para gestionar y analizar tus documentos de forma inteligente
      </p>

      <div className="mb-12">
        <img 
          src="/vite.svg" 
          alt="DocuSense" 
          className="mx-auto h-32 mb-8"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="p-6 border rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3">Almacenamiento Seguro</h3>
          <p>Guarda tus documentos importantes en una plataforma protegida y accesible desde cualquier lugar.</p>
        </div>
        
        <div className="p-6 border rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3">Analítica Inteligente</h3>
          <p>Extrae información clave de tus documentos automáticamente con nuestro sistema de procesamiento.</p>
        </div>
        
        <div className="p-6 border rounded-lg shadow-sm">
          <h3 className="text-xl font-semibold mb-3">Organización Eficiente</h3>
          <p>Categoriza y encuentra tus documentos al instante con búsquedas avanzadas y metadatos personalizados.</p>
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        {isAuthenticated ? (
          <Link to="/dashboard">
            <Button>Ir al Dashboard</Button>
          </Link>
        ) : (
          <>
            <Link to="/login">
              <Button>Iniciar Sesión</Button>
            </Link>
            <Link to="/register">
              <Button className="bg-green-600 hover:bg-green-700">Registrarse</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;