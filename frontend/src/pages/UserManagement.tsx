import { useState, useEffect } from 'react';
import { api } from '../api/client';

const UserManagement = () => {
  // Estados
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para edición/creación
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    isAdmin: false,
  });

  // Estados para eliminación
  const [userToDelete, setUserToDelete] = useState(null);

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
      const mockData = [
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
    const newUser = {
      id: `${users.length + 1}`,
      ...formData,
      createdAt: new Date().toISOString(),
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
  const handleEdit = (user) => {
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
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Manejar envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUser) {
      updateUser();
    } else {
      createUser();
    }
  };

  // Formatear fecha
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className='p-6 bg-white rounded-lg shadow-md'>
      <div className='sm:flex sm:items-center sm:justify-between sm:mb-6'>
        <div>
          <h1 className='text-xl font-semibold text-gray-900'>
            Gestión de Usuarios
          </h1>
          <p className='mt-2 text-sm text-gray-700'>
            Administra los usuarios del sistema, edita sus roles y permisos.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className='inline-flex items-center px-4 py-2 mt-4 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm sm:mt-0 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
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
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className='mb-6'>
        <input
          type='text'
          placeholder='Buscar usuarios...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
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
      ) : /* Tabla de usuarios */
      filteredUsers.length > 0 ? (
        <div className='overflow-hidden border border-gray-200 rounded-lg'>
          <table className='min-w-full divide-y divide-gray-200'>
            <thead className='bg-gray-50'>
              <tr>
                <th
                  scope='col'
                  className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                  Usuario
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                  Email
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                  Rol
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                  Seguridad
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase'>
                  Fecha Creación
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase'>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className='bg-white divide-y divide-gray-200'>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className='hover:bg-gray-50'>
                  <td className='px-6 py-4 whitespace-nowrap'>
                    <div className='flex items-center'>
                      <div className='flex-shrink-0 w-10 h-10'>
                        <div className='flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full'>
                          <span className='text-sm font-medium text-blue-800'>
                            {user.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className='ml-4'>
                        <div className='text-sm font-medium text-gray-900'>
                          {user.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='text-sm text-gray-900'>{user.email}</div>
                  </td>
                  <td className='px-6 py-4'>
                    <span
                      className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${
                        user.isAdmin
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                      {user.isAdmin ? 'Administrador' : 'Usuario'}
                    </span>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='flex space-x-1'>
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
                      {!user.twoFactorEnabled && !user.biometricAuthEnabled && (
                        <span className='inline-flex px-2 text-xs font-semibold leading-5 text-gray-800 bg-gray-100 rounded-full'>
                          Básica
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-6 py-4'>
                    <div className='text-sm text-gray-500'>
                      {formatDate(user.createdAt)}
                    </div>
                  </td>
                  <td className='px-6 py-4 text-right whitespace-nowrap'>
                    <div className='flex justify-end space-x-2'>
                      <button
                        onClick={() => handleEdit(user)}
                        className='text-blue-600 hover:text-blue-900'>
                        Editar
                      </button>
                      <button
                        onClick={() => setUserToDelete(user)}
                        className='text-red-600 hover:text-red-900'>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className='p-6 text-center bg-white border border-gray-200 rounded-lg'>
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
            <button
              onClick={handleCreate}
              className='inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
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
            </button>
          </div>
        </div>
      )}

      {/* Modal de formulario de usuario */}
      {showUserForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='w-full max-w-md p-6 bg-white rounded-lg shadow-xl'>
            <div className='flex items-center justify-between mb-4'>
              <h2 className='text-xl font-medium text-gray-900'>
                {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button
                onClick={() => setShowUserForm(false)}
                className='text-gray-400 hover:text-gray-500'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  className='w-6 h-6'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className='mb-4'>
                <label className='block text-sm font-medium text-gray-700'>
                  Nombre
                </label>
                <input
                  type='text'
                  name='name'
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  className='block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div className='mb-4'>
                <label className='block text-sm font-medium text-gray-700'>
                  Email
                </label>
                <input
                  type='email'
                  name='email'
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                  className='block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div className='mb-4'>
                <label className='block text-sm font-medium text-gray-700'>
                  {selectedUser
                    ? 'Contraseña (dejar en blanco para no cambiar)'
                    : 'Contraseña'}
                </label>
                <input
                  type='password'
                  name='password'
                  value={formData.password}
                  onChange={handleFormChange}
                  required={!selectedUser}
                  className='block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500'
                />
              </div>

              <div className='flex items-center mb-4'>
                <input
                  type='checkbox'
                  id='isAdmin'
                  name='isAdmin'
                  checked={formData.isAdmin}
                  onChange={handleFormChange}
                  className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                />
                <label
                  htmlFor='isAdmin'
                  className='block ml-2 text-sm text-gray-900'>
                  Administrador
                </label>
              </div>

              <div className='flex justify-end mt-6 space-x-3'>
                <button
                  type='button'
                  onClick={() => setShowUserForm(false)}
                  className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
                  Cancelar
                </button>
                <button
                  type='submit'
                  className='px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
                  {selectedUser ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {userToDelete && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='w-full max-w-md p-6 bg-white rounded-lg shadow-xl'>
            <div className='flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full'>
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-6 h-6 text-red-600'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                />
              </svg>
            </div>

            <div className='mt-3 text-center'>
              <h3 className='text-lg font-medium text-gray-900'>
                Eliminar Usuario
              </h3>
              <p className='mt-2 text-sm text-gray-500'>
                ¿Estás seguro de que deseas eliminar a{' '}
                <span className='font-medium'>{userToDelete.name}</span>? Esta
                acción no se puede deshacer.
              </p>
            </div>

            <div className='flex justify-end mt-6 space-x-3'>
              <button
                onClick={() => setUserToDelete(null)}
                className='px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
                Cancelar
              </button>
              <button
                onClick={deleteUser}
                className='px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menú lateral */}
      <div className='fixed top-0 right-0 z-40 w-64 h-full p-6 bg-white border-l border-gray-200 shadow-md'>
        <div className='space-y-4'>
          <h3 className='text-lg font-medium text-gray-900'>
            Panel de administración
          </h3>
          <div className='space-y-1'>
            <a
              href='#'
              className='block px-3 py-2 text-base font-medium text-gray-900 bg-gray-100 rounded-md'>
              Gestión de usuarios
            </a>
            <a
              href='#'
              className='block px-3 py-2 text-base font-medium text-gray-600 rounded-md hover:bg-gray-50'>
              Configuración del sistema
            </a>
            <a
              href='#'
              className='block px-3 py-2 text-base font-medium text-gray-600 rounded-md hover:bg-gray-50'>
              Analíticas
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
