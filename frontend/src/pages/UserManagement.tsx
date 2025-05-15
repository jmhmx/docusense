import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from '../components/Button';
import Input from '../components/Input';

// Tipos
interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  biometricAuthEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

interface UserFormData {
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
}

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
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
        user => 
          user.name.toLowerCase().includes(query) || 
          user.email.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [users, searchQuery]);
  
  // Función para cargar usuarios
  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (err: any) {
      console.error('Error cargando usuarios:', err);
      setError(err.response?.data?.message || 'Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Función para crear usuario
  const createUser = async () => {
    setIsSubmitting(true);
    setFormError('');
    
    try {
      // Validación básica
      if (!formData.name.trim() || !formData.email.trim() || !formData.password?.trim()) {
        setFormError('Todos los campos son obligatorios');
        setIsSubmitting(false);
        return;
      }
      
      const response = await api.post('/api/admin/users', formData);
      
      // Actualizar lista de usuarios
      setUsers(prev => [...prev, response.data]);
      
      // Cerrar formulario
      resetForm();
      setShowUserForm(false);
    } catch (err: any) {
      console.error('Error creando usuario:', err);
      setFormError(err.response?.data?.message || 'Error al crear usuario');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Función para actualizar usuario
  const updateUser = async () => {
    if (!selectedUser) return;
    
    setIsSubmitting(true);
    setFormError('');
    
    try {
      // Validación básica
      if (!formData.name.trim() || !formData.email.trim()) {
        setFormError('Nombre y email son obligatorios');
        setIsSubmitting(false);
        return;
      }
      
      // Si no se proporciona contraseña, no enviarla (para no cambiarla)
      const dataToSend = { ...formData };
      if (!dataToSend.password) {
        delete dataToSend.password;
      }
      
      const response = await api.patch(`/api/admin/users/${selectedUser.id}`, dataToSend);
      
      // Actualizar lista de usuarios
      setUsers(prev => 
        prev.map(user => user.id === selectedUser.id ? { ...user, ...response.data } : user)
      );
      
      // Cerrar formulario
      resetForm();
      setShowUserForm(false);
    } catch (err: any) {
      console.error('Error actualizando usuario:', err);
      setFormError(err.response?.data?.message || 'Error al actualizar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Función para eliminar usuario
  const deleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      await api.delete(`/api/admin/users/${userToDelete.id}`);
      
      // Eliminar de la lista
      setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
      
      // Cerrar diálogo
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Error eliminando usuario:', err);
      alert(err.response?.data?.message || 'Error al eliminar usuario');
    }
  };
  
  // Resetear formulario
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      isAdmin: false,
    });
    setFormError('');
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
    setFormData(prev => ({
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
    <div className="px-4 py-6">
      {/* Encabezado */}
      <div className="sm:flex sm:items-center sm:justify-between sm:mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gestión de Usuarios</h1>
          <p className="mt-2 text-sm text-gray-700">
            Administra los usuarios del sistema, edita sus roles y permisos.
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="mt-4 sm:mt-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 -ml-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Nuevo Usuario
        </Button>
      </div>
      
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col mb-6 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            className="mb-4 sm:mb-0"
          />
        </div>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <div className="p-4 mb-4 border-l-4 border-red-500 bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchUsers}
                className="mt-2 text-sm font-medium text-red-700 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Estado de carga */}
      {isLoading ? (
        <div className="flex items-center justify-center p-6">
          <svg className="w-10 h-10 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : (
        /* Tabla de usuarios */
        filteredUsers.length > 0 ? (
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Usuario
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Rol
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Seguridad
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
                    Fecha Creación
                  </th>
                  <th scope="col" className="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-10 h-10">
                          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                            <span className="text-sm font-medium text-blue-800">
                              {user.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 text-xs font-semibold leading-5 rounded-full ${
                        user.isAdmin 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.isAdmin ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-1">
                        {user.twoFactorEnabled && (
                          <span className="inline-flex px-2 text-xs font-semibold leading-5 text-blue-800 bg-blue-100 rounded-full">
                            2FA
                          </span>
                        )}
                        {user.biometricAuthEnabled && (
                          <span className="inline-flex px-2 text-xs font-semibold leading-5 text-indigo-800 bg-indigo-100 rounded-full">
                            Biometría
                          </span>
                        )}
                        {!user.twoFactorEnabled && !user.biometricAuthEnabled && (
                          <span className="inline-flex px-2 text-xs font-semibold leading-5 text-gray-800 bg-gray-100 rounded-full">
                            Básica
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setUserToDelete(user)}
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
          </div>
        ) : (
          <div className="p-6 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron usuarios</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery 
                ? 'No hay usuarios que coincidan con tu búsqueda.' 
                : 'Comienza creando un nuevo usuario.'}
            </p>
            <div className="mt-6">
              <Button onClick={handleCreate}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 -ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Nuevo Usuario
              </Button>
            </div>
          </div>
        )
      )}
      
      {/* Modal de formulario de usuario */}
      {showUserForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-gray-900">
                {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button
                onClick={() => setShowUserForm(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {formError && (
              <div className="p-3 mb-4 text-sm border-l-4 border-red-500 bg-red-50">
                <p className="font-medium text-red-800">{formError}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  fullWidth
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                  fullWidth
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  {selectedUser ? 'Contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}
                </label>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  required={!selectedUser}
                  fullWidth
                />
              </div>
              
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="isAdmin"
                  name="isAdmin"
                  checked={formData.isAdmin}
                  onChange={handleFormChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isAdmin" className="block ml-2 text-sm text-gray-900">
                  Administrador
                </label>
              </div>
              
              <div className="flex justify-end mt-6 space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowUserForm(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Guardando...' : selectedUser ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de confirmación de eliminación */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900">Eliminar Usuario</h3>
              <p className="mt-2 text-sm text-gray-500">
                ¿Estás seguro de que deseas eliminar a <span className="font-medium">{userToDelete.name}</span>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            
            <div className="flex justify-end mt-6 space-x-3">
              <Button
                variant="secondary"
                onClick={() => setUserToDelete(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={deleteUser}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;