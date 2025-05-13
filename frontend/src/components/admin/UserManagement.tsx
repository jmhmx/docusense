import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Button from '../../components/Button';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tenants, setTenants] = useState([]);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    isAdmin: false,
    tenantId: '',
    roleId: '',
    isActive: true
  });
  const [formErrors, setFormErrors] = useState({});

  // Cargar usuarios al inicio
  useEffect(() => {
    fetchUsers();
    fetchTenants();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
      setError('No se pudieron cargar los usuarios. Verifica tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.get('/api/admin/tenants');
      setTenants(response.data);
    } catch (err) {
      console.error('Error al cargar tenants:', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get('/api/admin/roles');
      setRoles(response.data);
    } catch (err) {
      console.error('Error al cargar roles:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      errors.email = 'El correo es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'El correo no es válido';
    }

    if (!currentUser && !formData.password) {
      errors.password = 'La contraseña es requerida';
    } else if (!currentUser && formData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!formData.tenantId) {
      errors.tenantId = 'Seleccione un tenant';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await api.post('/api/admin/users', formData);
      setFormData({
        name: '',
        email: '',
        password: '',
        isAdmin: false,
        tenantId: '',
        roleId: '',
        isActive: true
      });
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setFormErrors({
          submit: err.response.data.message
        });
      } else {
        setFormErrors({
          submit: 'Error al crear usuario'
        });
      }
      console.error('Error creando usuario:', err);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      // Omitir la contraseña si está vacía
      const dataToSend = {...formData};
      if (!dataToSend.password) {
        delete dataToSend.password;
      }

      await api.put(`/api/admin/users/${currentUser.id}`, dataToSend);
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        setFormErrors({
          submit: err.response.data.message
        });
      } else {
        setFormErrors({
          submit: 'Error al actualizar usuario'
        });
      }
      console.error('Error actualizando usuario:', err);
    }
  };

  const handleEditUser = (user) => {
    setCurrentUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // No enviamos la contraseña actual por seguridad
      isAdmin: user.isAdmin,
      tenantId: user.tenantId,
      roleId: user.roleId || '',
      isActive: user.isActive !== false // Si no está definido, asumimos que está activo
    });
    setShowEditModal(true);
  };

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que deseas desactivar este usuario?')) {
      return;
    }

    try {
      await api.patch(`/api/admin/users/${userId}/deactivate`);
      fetchUsers();
    } catch (err) {
      console.error('Error al desactivar usuario:', err);
      setError('No se pudo desactivar el usuario');
    }
  };

  const handleActivateUser = async (userId) => {
    try {
      await api.patch(`/api/admin/users/${userId}/activate`);
      fetchUsers();
    } catch (err) {
      console.error('Error al activar usuario:', err);
      setError('No se pudo activar el usuario');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await api.delete(`/api/admin/users/${userId}`);
      fetchUsers();
    } catch (err) {
      console.error('Error al eliminar usuario:', err);
      setError('No se pudo eliminar el usuario');
    }
  };

  const filteredUsers = users.filter(
    user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Función para obtener el nombre del tenant
  const getTenantName = (tenantId) => {
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? tenant.name : 'Desconocido';
  };

  // Función para obtener el nombre del rol
  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Sin rol específico';
  };

  return (
    <div className="p-6">
      <div className="flex flex-col justify-between md:flex-row md:items-center">
        <h2 className="mb-4 text-2xl font-bold text-gray-800 md:mb-0">Gestión de Usuarios</h2>
        <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar usuarios..."
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg
              className="absolute w-5 h-5 text-gray-400 right-3 top-2.5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <Button
            onClick={() => {
              setCurrentUser(null);
              setFormData({
                name: '',
                email: '',
                password: '',
                isAdmin: false,
                tenantId: '',
                roleId: '',
                isActive: true
              });
              setFormErrors({});
              setShowCreateModal(true);
            }}
            variant="primary"
          >
            Agregar Usuario
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 mt-4 text-sm text-red-700 bg-red-100 rounded-md" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-10 h-10 border-4 rounded-full border-t-blue-500 border-b-blue-500 animate-spin"></div>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Nombre</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tenant</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Rol</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Estado</th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-center text-gray-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 whitespace-nowrap sm:pl-6">
                      {user.name} {user.isAdmin && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Admin</span>}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">{user.email}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">{getTenantName(user.tenantId)}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">{getRoleName(user.roleId)}</td>
                    <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {user.isActive !== false ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Editar
                        </button>
                        {user.isActive !== false ? (
                          <button
                            onClick={() => handleDeactivateUser(user.id)}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateUser(user.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Activar
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para crear usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Crear Nuevo Usuario</h3>
                <div className="mt-2">
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre</label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.name ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      />
                      {formErrors.name && <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      />
                      {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">Contraseña</label>
                      <input
                        type="password"
                        name="password"
                        id="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      />
                      {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="tenantId" className="block text-sm font-medium text-gray-700">Tenant</label>
                      <select
                        name="tenantId"
                        id="tenantId"
                        value={formData.tenantId}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.tenantId ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      >
                        <option value="">Seleccione un tenant</option>
                        {tenants.map(tenant => (
                          <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                        ))}
                      </select>
                      {formErrors.tenantId && <p className="mt-1 text-sm text-red-600">{formErrors.tenantId}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="roleId" className="block text-sm font-medium text-gray-700">Rol</label>
                      <select
                        name="roleId"
                        id="roleId"
                        value={formData.roleId}
                        onChange={handleInputChange}
                        className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Sin rol específico</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="isAdmin"
                        id="isAdmin"
                        checked={formData.isAdmin}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="isAdmin" className="block ml-2 text-sm text-gray-700">
                        ¿Es Administrador?
                      </label>
                    </div>
                    
                    {formErrors.submit && (
                      <div className="p-3 text-sm text-red-700 bg-red-100 rounded">
                        {formErrors.submit}
                      </div>
                    )}
                    
                    <div className="flex justify-end mt-5 space-x-3">
                      <Button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        variant="secondary"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                      >
                        Crear Usuario
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar usuario */}
      {showEditModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Editar Usuario</h3>
                <div className="mt-2">
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                      <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">Nombre</label>
                      <input
                        type="text"
                        name="name"
                        id="edit-name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.name ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      />
                      {formErrors.name && <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                      <input
                        type="email"
                        name="email"
                        id="edit-email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      />
                      {formErrors.email && <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="edit-password" className="block text-sm font-medium text-gray-700">
                        Contraseña <span className="text-xs font-normal text-gray-500">(Dejar en blanco para no cambiar)</span>
                      </label>
                      <input
                        type="password"
                        name="password"
                        id="edit-password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      />
                      {formErrors.password && <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="edit-tenantId" className="block text-sm font-medium text-gray-700">Tenant</label>
                      <select
                        name="tenantId"
                        id="edit-tenantId"
                        value={formData.tenantId}
                        onChange={handleInputChange}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                          formErrors.tenantId ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                      >
                        <option value="">Seleccione un tenant</option>
                        {tenants.map(tenant => (
                          <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                        ))}
                      </select>
                      {formErrors.tenantId && <p className="mt-1 text-sm text-red-600">{formErrors.tenantId}</p>}
                    </div>
                    
                    <div>
                      <label htmlFor="edit-roleId" className="block text-sm font-medium text-gray-700">Rol</label>
                      <select
                        name="roleId"
                        id="edit-roleId"
                        value={formData.roleId}
                        onChange={handleInputChange}
                        className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="">Sin rol específico</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="isAdmin"
                        id="edit-isAdmin"
                        checked={formData.isAdmin}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="edit-isAdmin" className="block ml-2 text-sm text-gray-700">
                        ¿Es Administrador?
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="isActive"
                        id="edit-isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="edit-isActive" className="block ml-2 text-sm text-gray-700">
                        ¿Usuario Activo?
                      </label>
                    </div>
                    
                    {formErrors.submit && (
                      <div className="p-3 text-sm text-red-700 bg-red-100 rounded">
                        {formErrors.submit}
                      </div>
                    )}
                    
                    <div className="flex justify-end mt-5 space-x-3">
                      <Button
                        type="button"
                        onClick={() => setShowEditModal(false)}
                        variant="secondary"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                      >
                        Actualizar Usuario
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;