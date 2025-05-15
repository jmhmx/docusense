import { useState, useEffect } from 'react';
import { User, UserFormData } from '../types/user';
import Button from '../components/Button';
import Input from '../components/Input';
import UserFormModal from '../components/UserFormModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

const UserManagement = () => {
  // Estados
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para edición/creación
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    isAdmin: false,
  });

  // Estados para eliminación
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Cargar usuarios al iniciar
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtrar usuarios cuando cambie la búsqueda
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query),
      );
      setFilteredUsers(filtered);
    }
  }, [users, searchQuery]);

  // Función para cargar usuarios
  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');

    try {
      // En un entorno real, esta llamada API retornaría usuarios reales
      // Por ahora usaremos datos de ejemplo
      const mockData: User[] = [
        {
          id: '1',
          name: 'María López',
          email: 'maria@example.com',
          isAdmin: false,
          twoFactorEnabled: true,
          biometricAuthEnabled: false,
          createdAt: '2025-04-15T10:30:00Z',
        },
        {
          id: '2',
          name: 'Pedro García',
          email: 'pedro@example.com',
          isAdmin: true,
          twoFactorEnabled: true,
          biometricAuthEnabled: true,
          createdAt: '2025-03-16T14:20:00Z',
        },
        {
          id: '3',
          name: 'Ana Rodríguez',
          email: 'ana@example.com',
          isAdmin: false,
          twoFactorEnabled: false,
          biometricAuthEnabled: false,
          createdAt: '2025-05-01T09:15:00Z',
        },
        {
          id: '4',
          name: 'Carlos Martínez',
          email: 'carlos@example.com',
          isAdmin: false,
          twoFactorEnabled: true,
          biometricAuthEnabled: false,
          createdAt: '2025-04-20T16:45:00Z',
        },
      ];

      setUsers(mockData);
      setFilteredUsers(mockData);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setError('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para crear usuario
  const createUser = async () => {
    // Simulación de creación
    const newUser: User = {
      id: `${users.length + 1}`,
      ...formData,
      createdAt: new Date().toISOString(),
      twoFactorEnabled: false,
      biometricAuthEnabled: false,
    };

    setUsers([...users, newUser]);
    setShowUserForm(false);
    resetForm();
  };

  // Función para actualizar usuario
  const updateUser = async () => {
    if (!selectedUser) return;

    // Actualizar el usuario en la lista
    const updatedUsers = users.map((user) =>
      user.id === selectedUser.id ? { ...user, ...formData } : user,
    );

    setUsers(updatedUsers);
    setShowUserForm(false);
    resetForm();
  };

  // Función para eliminar usuario
  const deleteUser = async () => {
    if (!userToDelete) return;

    // Eliminar el usuario de la lista
    setUsers(users.filter((user) => user.id !== userToDelete.id));
    setUserToDelete(null);
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      isAdmin: false,
    });
    setSelectedUser(null);
  };

  // Abrir formulario para editar
  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // No incluir contraseña al editar
      isAdmin: user.isAdmin,
    });
    setShowUserForm(true);
  };

  // Abrir formulario para crear
  const handleCreate = () => {
    resetForm();
    setShowUserForm(true);
  };

  // Manejar cambios en el formulario
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Manejar envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateUser();
    } else {
      createUser();
    }
  };

  // Formatear fecha
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className='px-4 py-8 pt-16 mx-auto max-w-7xl sm:px-6 lg:px-8'>
      <div className='mb-8 md:flex md:items-center md:justify-between'>
        <div className='flex-1 min-w-0'>
          <h1 className='text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate'>
            Gestión de Usuarios
          </h1>
          <p className='mt-1 text-sm text-gray-500'>
            Administra los usuarios del sistema, edita sus roles y permisos.
          </p>
        </div>
        <div className='flex mt-4 md:mt-0 md:ml-4'>
          <Button onClick={handleCreate}>
            <svg
              className='w-5 h-5 mr-2 -ml-1'
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 20 20'
              fill='currentColor'>
              <path
                fillRule='evenodd'
                d='M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z'
                clipRule='evenodd'
              />
            </svg>
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className='mb-6'>
        <Input
          type='text'
          placeholder='Buscar usuarios...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
        />
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className='p-4 mb-4 border-l-4 border-red-500 bg-red-50'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='w-5 h-5 text-red-400'
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm text-red-700'>{error}</p>
              <button
                onClick={fetchUsers}
                className='mt-2 text-sm font-medium text-red-700 underline'>
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estado de carga */}
      {isLoading ? (
        <div className='flex items-center justify-center p-6'>
          <svg
            className='w-10 h-10 text-blue-500 animate-spin'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'>
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'></circle>
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'></path>
          </svg>
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className='overflow-hidden bg-white shadow sm:rounded-md'>
          <ul className='divide-y divide-gray-200'>
            {filteredUsers.map((user) => (
              <li key={user.id}>
                <div className='px-4 py-4 sm:px-6'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center flex-1 min-w-0'>
                      <div className='flex-shrink-0'>
                        <div className='flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full'>
                          <span className='text-sm font-medium text-blue-800'>
                            {user.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className='flex-1 min-w-0 px-4'>
                        <p className='text-sm font-medium text-indigo-600 truncate'>
                          {user.name}
                        </p>
                        <p className='mt-1 text-sm text-gray-500 truncate'>
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className='flex flex-col items-end ml-2'>
                      <span
                        className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${
                          user.isAdmin
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                        {user.isAdmin ? 'Administrador' : 'Usuario'}
                      </span>
                      <div className='flex mt-2 space-x-1'>
                        {user.twoFactorEnabled && (
                          <span className='inline-flex px-2 text-xs font-semibold leading-5 text-blue-800 bg-blue-100 rounded-full'>
                            2FA
                          </span>
                        )}
                        {user.biometricAuthEnabled && (
                          <span className='inline-flex px-2 text-xs font-semibold leading-5 text-indigo-800 bg-indigo-100 rounded-full'>
                            Biometría
                          </span>
                        )}
                      </div>
                    </div>
                    <div className='flex ml-6'>
                      <p className='text-sm text-gray-500'>
                        {formatDate(user.createdAt)}
                      </p>
                    </div>
                    <div className='flex ml-6 space-x-2'>
                      <button
                        type='button'
                        onClick={() => handleEdit(user)}
                        className='text-blue-600 hover:text-blue-900'>
                        Editar
                      </button>
                      <button
                        type='button'
                        onClick={() => setUserToDelete(user)}
                        className='text-red-600 hover:text-red-900'>
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className='p-12 text-center bg-white rounded-lg shadow'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-12 h-12 mx-auto text-gray-400'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'>
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
            />
          </svg>
          <h3 className='mt-2 text-sm font-medium text-gray-900'>
            No se encontraron usuarios
          </h3>
          <p className='mt-1 text-sm text-gray-500'>
            {searchQuery
              ? 'No hay usuarios que coincidan con tu búsqueda.'
              : 'Comienza creando un nuevo usuario.'}
          </p>
          <div className='mt-6'>
            <Button onClick={handleCreate}>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-5 h-5 mr-2 -ml-1'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z'
                  clipRule='evenodd'
                />
              </svg>
              Nuevo Usuario
            </Button>
          </div>
        </div>
      )}

      {/* Modal de formulario de usuario */}
      {showUserForm && (
        <UserFormModal
          isOpen={showUserForm}
          onClose={() => setShowUserForm(false)}
          title={selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
          formData={formData}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          isEdit={!!selectedUser}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {userToDelete && (
        <DeleteConfirmationModal
          user={userToDelete}
          isOpen={!!userToDelete}
          onConfirm={deleteUser}
          onCancel={() => setUserToDelete(null)}
        />
      )}
    </div>
  );
};

export default UserManagement;
