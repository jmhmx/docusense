import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import { api } from '../api/client';
import Button from '../components/Button';
import Input from '../components/Input';
import UserForm from './UserForm';

// Tipos
interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  biometricAuthEnabled?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface UserFilter {
  search: string;
  role: string;
  authMethod: string;
}

const UserManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados principales
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [usersPerPage] = useState(10);
  
  // Estados para filtrado
  const [filters, setFilters] = useState<UserFilter>({
    search: '',
    role: 'all',
    authMethod: 'all',
  });
  
  // Estados para edición
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  
  // Estados para confirmaciones
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  // Cargar usuarios al iniciar
  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/dashboard');
      return;
    }
    
    fetchUsers();
  }, [navigate, user, currentPage, filters]);
  
  // Función para obtener la lista de usuarios
  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Construir query params para filtros y paginación
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: usersPerPage.toString(),
        search: filters.search,
      });
      
      if (filters.role !== 'all') {
        queryParams.append('role', filters.role);
      }
      
      if (filters.authMethod !== 'all') {
        queryParams.append('authMethod', filters.authMethod);
      }
      
      const response = await api.get(`/api/admin/users?${queryParams.toString()}`);
      
      setUsers(response.data.users);
      setTotalPages(Math.ceil(response.data.total / usersPerPage));
    } catch (err: any) {
      console.error('Error al cargar usuarios:', err);
      setError(err?.response?.data?.message || 'Error al cargar usuarios. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Función para aplicar filtros
  const handleFilterChange = (filterName: keyof UserFilter, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setCurrentPage(1); // Resetear a primera página al cambiar filtros
  };
  
  // Agregar nuevo usuario
  const handleAddUser = () => {
    setIsNewUser(true);
    setSelectedUser(null);
    setShowUserForm(true);
  };
  
  // Editar usuario existente
  const handleEditUser = (user: User) => {
    setIsNewUser(false);
    setSelectedUser(user);
    setShowUserForm(true);
  };
  
  // Iniciar proceso de eliminación
  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };
  
  // Confirmar eliminación
  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      await api.delete(`/api/admin/users/${userToDelete.id}`);
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Error al eliminar usuario:', err);
      setError(err?.response?.data?.message || 'Error al eliminar el usuario. Intente nuevamente.');
    }
  };
  
  // Cambiar rol de usuario (toggle admin)
  const handleRoleToggle = async (userId: string, makeAdmin: boolean) => {
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { isAdmin: makeAdmin });
      
      // Actualizar la lista de usuarios localmente
      setUsers(users.map(u => 
        u.id === userId ? { ...u, isAdmin: makeAdmin } : u
      ));
    } catch (err: any) {
      console.error('Error al cambiar rol de usuario:', err);
      setError(err?.response?.data?.message || 'Error al cambiar el rol del usuario. Intente nuevamente.');
    }
  };
  
  // Guardar usuario (nuevo o editado)
  const handleSaveUser = async (userData: Partial<User>) => {
    try {
      if (isNewUser) {
        // Crear nuevo usuario
        const response = await api.post('/api/admin/users', userData);
        setUsers([...users, response.data]);
      } else if (selectedUser) {
        // Actualizar usuario existente
        const response = await api.patch(`/api/admin/users/${selectedUser.id}`, userData);
        setUsers(users.map(u => u.id === selectedUser.id ? response.data : u));
      }
      
      setShowUserForm(false);
      setSelectedUser(null);
      setIsNewUser(false);
    } catch (err: any) {
      console.error('Error al guardar usuario:', err);
      return { error: err?.response?.data?.message || 'Error al guardar el usuario. Intente nuevamente.' };
    }
    
    return { success: true };
  };
  
  // Formatear fecha
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Renderizado del componente
  return (
    <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
            <p className="mt-1 text-sm text-gray-500">
              Administra usuarios, roles y permisos
            </p>
          </div>
          <div>
            <Button 
              onClick={handleAddUser}
              variant="primary"
            >
              <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo Usuario
            </Button>
          </div>
        </div>
      </div>
      
      {/* Panel de filtros */}
      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Buscar</label>
            <Input
              id="search"
              type="text"
              placeholder="Buscar por nombre o email"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              fullWidth
            />
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rol</label>
            <select
              id="role"
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="user">Usuarios</option>
            </select>
          </div>
          <div>
            <label htmlFor="authMethod" className="block text-sm font-medium text-gray-700">Método de autenticación</label>
            <select
              id="authMethod"
              value={filters.authMethod}
              onChange={(e) => handleFilterChange('authMethod', e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">Todos</option>
              <option value="2fa">2FA habilitado</option>
              <option value="biometric">Biometría habilitada</option>
              <option value="standard">Estándar</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
          <p>{error}</p>
        </div>
      )}
      
      {/* Tabla de usuarios */}
      <div className="flex flex-col mt-8">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-8 h-8 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <svg className="w-12 h-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">No se encontraron usuarios</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Nombre
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Rol
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Autenticación
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Creado
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Último acceso
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 whitespace-nowrap sm:pl-6">
                          {user.name}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {user.email}
                        </td>
                        <td className="px-3 py-4 text-sm whitespace-nowrap">
                          {user.isAdmin ? (
                            <span className="inline-flex px-2 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                              Administrador
                            </span>
                          ) : (
                            <span className="inline-flex px-2 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">
                              Usuario
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {user.biometricAuthEnabled && (
                              <span className="inline-flex px-2 text-xs font-semibold text-purple-800 bg-purple-100 rounded-full">
                                Biometría
                              </span>
                            )}
                            {user.twoFactorEnabled && (
                              <span className="inline-flex px-2 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
                                2FA
                              </span>
                            )}
                            {!user.biometricAuthEnabled && !user.twoFactorEnabled && (
                              <span className="inline-flex px-2 text-xs font-semibold text-gray-800 bg-gray-100 rounded-full">
                                Estándar
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(user.lastLogin)}
                        </td>
                        <td className="py-4 pl-3 pr-4 text-sm font-medium text-right whitespace-nowrap sm:pr-6">
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => handleRoleToggle(user.id, !user.isAdmin)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              {user.isAdmin ? 'Quitar Admin' : 'Hacer Admin'}
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleEditUser(user)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Editar
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(user)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 mt-6 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex justify-between flex-1 sm:hidden">
            <button
              onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${currentPage === 1 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50'} bg-white border border-gray-300 rounded-md`}
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium ${currentPage === totalPages ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50'} bg-white border border-gray-300 rounded-md`}
            >
              Siguiente
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Mostrando <span className="font-medium">{(currentPage - 1) * usersPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * usersPerPage, users.length)}</span> de <span className="font-medium">{users.length}</span> usuarios
              </p>
            </div>
            <div>
              <nav className="inline-flex -space-x-px rounded-md shadow-sm isolate" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-2 py-2 ${currentPage === 1 ? 'text-gray-300' : 'text-gray-400 hover:bg-gray-50'} rounded-l-md bg-white border border-gray-300`}
                >
                  <span className="sr-only">Anterior</span>
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Mostrar botones de página */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                      page === currentPage 
                        ? 'text-white bg-blue-600 focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' 
                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20'
                    } focus:z-20`}
                  >
                    {page}
                  </button>
                ))}
                
                <button
                  onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-2 py-2 ${currentPage === totalPages ? 'text-gray-300' : 'text-gray-400 hover:bg-gray-50'} rounded-r-md bg-white border border-gray-300`}
                >
                  <span className="sr-only">Siguiente</span>
                  <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de formulario de usuario */}
      {showUserForm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  onClick={() => setShowUserForm(false)}
                  className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="sr-only">Cerrar</span>
                  <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="sm:flex sm:items-start">
                <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-blue-100 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    {isNewUser ? 'Nuevo Usuario' : 'Editar Usuario'}
                  </h3>
                </div>
              </div>
              <div className="mt-4">
                <UserForm 
                  initialData={selectedUser} 
                  onSave={handleSaveUser}
                  onCancel={() => setShowUserForm(false)}
                  isNew={isNewUser}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-red-100 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="w-6 h-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg font-medium leading-6 text-gray-900">
                    Eliminar Usuario
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      ¿Estás seguro de que deseas eliminar a este usuario? Esta acción no se puede deshacer.
                    </p>
                    {userToDelete && (
                      <div className="p-4 mt-3 border border-gray-200 rounded-md">
                        <p className="font-semibold">{userToDelete.name}</p>
                        <p className="text-sm text-gray-500">{userToDelete.email}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setUserToDelete(null);
                  }}
                  className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;