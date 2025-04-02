import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from './Input';
import Button from './Button';
import useAuth from '../hooks/UseAuth';

const Register = () => {
   const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error al registrarse:', error);
      if (error?.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Error al registrarse. Inténtalo de nuevo.');
      }
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Crear Cuenta</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <Input
          label="Nombre"
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          fullWidth
        />
        
        <Input
          label="Correo Electrónico"
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        
        <Input
          label="Contraseña"
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          fullWidth
        />
        
        <div className="mt-6">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Registrando...' : 'Registrarse'}
          </Button>
        </div>
        
        <div className="mt-4 text-center">
          <p>
            ¿Ya tienes una cuenta?{' '}
            <a
              href="/login"
              className="text-blue-500 hover:text-blue-700"
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
            >
              Inicia Sesión
            </a>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Register;