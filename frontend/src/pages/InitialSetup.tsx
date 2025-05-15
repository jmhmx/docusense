// frontend/src/pages/InitialSetup.tsx
import { useState } from 'react';
//import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Button from '../components/Button';
import Input from '../components/Input';

const InitialSetup = () => {
  //const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    setupKey: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await api.post('/api/admin/setup/initial-admin', formData);
      alert(
        'Administrador inicial creado correctamente. Ahora puedes iniciar sesión.',
      );
      //navigate('/login');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Error al crear administrador inicial',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100'>
      <div className='w-full max-w-md p-8 bg-white rounded-lg shadow-md'>
        <h1 className='mb-6 text-2xl font-bold text-center'>
          Configuración Inicial
        </h1>
        <p className='mb-4 text-gray-600'>
          Crea el primer usuario administrador para comenzar a utilizar el
          sistema. Necesitarás la clave de configuración proporcionada durante
          la instalación.
        </p>

        {error && (
          <div className='p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label='Nombre'
            name='name'
            value={formData.name}
            onChange={handleChange}
            required
            fullWidth
            className='mb-4'
          />
          <Input
            label='Email'
            name='email'
            type='email'
            value={formData.email}
            onChange={handleChange}
            required
            fullWidth
            className='mb-4'
          />
          <Input
            label='Contraseña'
            name='password'
            type='password'
            value={formData.password}
            onChange={handleChange}
            required
            fullWidth
            className='mb-4'
          />
          <Input
            label='Clave de configuración'
            name='setupKey'
            type='password'
            value={formData.setupKey}
            onChange={handleChange}
            required
            fullWidth
            className='mb-6'
          />

          <Button
            type='submit'
            disabled={isSubmitting}
            fullWidth>
            {isSubmitting ? 'Creando...' : 'Crear Administrador'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default InitialSetup;
