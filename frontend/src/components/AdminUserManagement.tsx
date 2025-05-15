import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import AdminSidebar from './AdminSidebar';
import UserFormModal from './UserFormModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const AdminUserManagement = () => {
  // Estados para la gestión de usuarios
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para modales
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Estado para los datos del formulario
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    isAdmin: false,
  });

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
      setError('Error al cargar usuarios. Por favor, intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para crear usuario
  const createUser = async () => {
    // Validación básica
    if (!formData.name || !formData.email || !formData.password) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    // Simulación de creación
    const newUser = {
      id: `${users.length + 1}`,
      ...formData,
      twoFactorEnabled: false,
      biometricAuthEnabled: false,
      createdAt: new Date().toISOString(),
    };

    setUsers([...users, newUser]);
    closeUserForm();
  };

  // Función para actualizar usuario
  const updateUser = async () => {
    if (!selectedUser) return;

    // Validación básica
    if (!formData.name || !formData.email) {
      setError('Nombre y email son campos obligatorios.');
      return;
    }

    // Actualizar el usuario en la lista
    const updatedUsers = users.map((user) =>
      user.id === selectedUser.id
        ? {
            ...user,
            name: formData.name,
            email: formData.email,
            isAdmin: formData.isAdmin,
            // No actualizamos la contraseña si está vacía
            ...(formData.password ? { password: formData.password } : {}),
          }
        : user,
    );

    setUsers(updatedUsers);
    closeUserForm();
  };

  // Función para eliminar usuario
  const deleteUser = async () => {
    if (!userToDelete) return;

    // Eliminar el usuario de la lista
    setUsers(users.filter((user) => user.id !== userToDelete.id));
    setUserToDelete(null);
  };

  // Abrir formulario para crear un nuevo usuario
  const openCreateForm = () => {
    setSelectedUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      isAdmin: false,
    });
    setShowUserForm(true);
  };

  // Abrir formulario para editar usuario
  const openEditForm = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // No incluir contraseña al editar
      isAdmin: user.isAdmin,
    });
    setShowUserForm(true);
  };

  // Cerrar formulario
  const closeUserForm = () => {
    setShowUserForm(false);
    setSelectedUser(null);
    setError('');
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
  const handleFormSubmit = () => {
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
    <div className='flex min-h-screen bg-gray-100'>
      {/* Barra lateral */}
      <AdminSidebar activeSection='users' />

      {/* Contenido principal */}
      <div className='flex-1 p-8 ml-64'>
        <div className='mb-8'>
          <h1 className='text-2xl font-bold text-gray-900'>
            Gestión de Usuarios
          </h1>
          <p className='mt-1 text-gray-600'>
            Administra los usuarios del sistema, edita sus roles y permisos.
          </p>
        </div>

        {/* Cabecera con búsqueda y botón de crear */}
        <div className='flex flex-col mb-6 md:flex-row md:items-center md:justify-between'>
          <div className='w-full mb-4 md:w-1/2 md:mb-0'>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
                <svg
                  className='w-5 h-5 text-gray-400'
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 20 20'
                  fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <input
                type='text'
                placeholder='Buscar usuarios...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              />
            </div>
          </div>
          <button
            onClick={openCreateForm}
            className='inline-flex items-center px-4 py-2 font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='w-5 h-5 mr-2'
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

        {/* Mensaje de error */}
        {error && (
          <div className='p-4 mb-6 border-l-4 border-red-500 rounded-lg bg-red-50'>
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

        {/* Listado de usuarios */}
        <div className='overflow-hidden bg-white rounded-lg shadow-md'>
          {isLoading ? (
            <div className='flex items-center justify-center p-12'>
              <div className='w-12 h-12 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin'></div>
              <span className='ml-3 text-gray-700'>Cargando usuarios...</span>
            </div>
          ) : (
            <>
              {filteredUsers.length === 0 ? (
                <div className='py-12 text-center'>
                  <svg
                    className='w-16 h-16 mx-auto text-gray-400'
                    xmlns='http://www.w3.org/2000/svg'
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
                  <h3 className='mt-4 text-lg font-medium text-gray-900'>
                    No se encontraron usuarios
                  </h3>
                  <p className='mt-1 text-gray-500'>
                    {searchQuery
                      ? 'No hay usuarios que coincidan con tu búsqueda.'
                      : 'Comienza por crear un nuevo usuario.'}
                  </p>
                  <button
                    onClick={openCreateForm}
                    className='inline-flex items-center px-4 py-2 mt-6 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'>
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
              ) : (
                <div className='overflow-x-auto'>
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
                              <div className='flex items-center justify-center flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full'>
                                <span className='font-semibold text-blue-800'>
                                  {user.name.substring(0, 2).toUpperCase()}
                                </span>
                              </div>
                              <div className='ml-4'>
                                <div className='text-sm font-medium text-gray-900'>
                                  {user.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='text-sm text-gray-900'>
                              {user.email}
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                user.isAdmin
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                              {user.isAdmin ? 'Administrador' : 'Usuario'}
                            </span>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
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
                              {!user.twoFactorEnabled &&
                                !user.biometricAuthEnabled && (
                                  <span className='inline-flex px-2 text-xs font-semibold leading-5 text-gray-800 bg-gray-100 rounded-full'>
                                    Básica
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='text-sm text-gray-500'>
                              {formatDate(user.createdAt)}
                            </div>
                          </td>
                          <td className='px-6 py-4 text-sm font-medium text-right whitespace-nowrap'>
                            <button
                              onClick={() => openEditForm(user)}
                              className='mr-4 text-blue-600 hover:text-blue-900'>
                              Editar
                            </button>
                            <button
                              onClick={() => setUserToDelete(user)}
                              className='text-red-600 hover:text-red-900'>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modales */}
      <UserFormModal
        isOpen={showUserForm}
        onClose={closeUserForm}
        user={selectedUser}
        formData={formData}
        onChange={handleFormChange}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmationModal
        user={userToDelete}
        isOpen={userToDelete !== null}
        onConfirm={deleteUser}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};

export default AdminUserManagement;
