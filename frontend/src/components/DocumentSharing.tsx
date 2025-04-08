import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from './Button';
//import Input from './Input';

interface User {
  id: string;
  name: string;
  email: string;
  permissionLevel: string;
  isOwner: boolean;
  sharedAt: string;
  expiresAt?: string;
}

interface ShareLink {
  id: string;
  token: string;
  permissionLevel: string;
  expiresAt: string;
  requiresPassword: boolean;
  isActive: boolean;
  createdAt: string;
  accessCount: number;
}

interface DocumentSharingProps {
  documentId: string;
  documentTitle: string;
  onPermissionsUpdated?: () => void;
}

const DocumentSharing = ({ documentId, documentTitle, onPermissionsUpdated }: DocumentSharingProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [email, setEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('viewer');
  const [expirationDate, setExpirationDate] = useState('');
  const [message, setMessage] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchShareLinks();
    checkSharePermission();
  }, [documentId]);

  const checkSharePermission = async () => {
    try {
      const response = await api.get(`/api/sharing/document/${documentId}/check-permission?action=share`);
      setCanShare(response.data.canAccess);
    } catch (err) {
      setCanShare(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get(`/api/sharing/document/${documentId}/users`);
      setUsers(response.data);
    } catch (err: any) {
      console.error('Error fetching shared users:', err);
      setError('Error al cargar usuarios compartidos');
    }
  };

  const fetchShareLinks = async () => {
    try {
      const response = await api.get(`/api/sharing/document/${documentId}/links`);
      setShareLinks(response.data);
    } catch (err: any) {
      console.error('Error fetching share links:', err);
      // No mostramos error para esto
    }
  };

  const handleEmailShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('/api/sharing/document', {
        documentId,
        email,
        permissionLevel,
        expiresAt: expirationDate || undefined,
        message: message || undefined,
        notifyUser: true,
      });

      setSuccess(`Documento compartido con ${email}`);
      setEmail('');
      setMessage('');
      fetchUsers();
      
      if (onPermissionsUpdated) {
        onPermissionsUpdated();
      }
    } catch (err: any) {
      console.error('Error sharing document:', err);
      setError(err?.response?.data?.message || 'Error al compartir documento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setShareLink(null);

    if (!expirationDate) {
      setError('La fecha de expiración es requerida');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.post('/api/sharing/link', {
        documentId,
        permissionLevel,
        expiresAt: expirationDate,
        requiresPassword: requirePassword,
        password: requirePassword ? password : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
      });

      setSuccess('Enlace de compartición creado con éxito');
      setShareLink(`${window.location.origin}/share/${response.data.token}`);
      fetchShareLinks();
    } catch (err: any) {
      console.error('Error creating share link:', err);
      setError(err?.response?.data?.message || 'Error al crear enlace de compartición');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!window.confirm('¿Está seguro de revocar el acceso a este usuario?')) {
      return;
    }

    try {
      // Primero necesitamos obtener el ID del permiso
      const response = await api.get(`/api/sharing/document/${documentId}/permissions`);
      const permissions = response.data;
      const permission = permissions.find((p: { userId: string }) => p.userId === userId)

      if (!permission) {
        setError('No se encontró el permiso para este usuario');
        return;
      }

      await api.delete(`/api/sharing/permissions/${permission.id}`);
      setSuccess('Acceso revocado exitosamente');
      fetchUsers();
      
      if (onPermissionsUpdated) {
        onPermissionsUpdated();
      }
    } catch (err: any) {
      console.error('Error revoking access:', err);
      setError(err?.response?.data?.message || 'Error al revocar acceso');
    }
  };

  const handleDeactivateLink = async (linkId: string) => {
    if (!window.confirm('¿Está seguro de desactivar este enlace de compartición?')) {
      return;
    }

    try {
      await api.delete(`/api/sharing/link/${linkId}`);
      setSuccess('Enlace desactivado exitosamente');
      fetchShareLinks();
    } catch (err: any) {
      console.error('Error deactivating link:', err);
      setError(err?.response?.data?.message || 'Error al desactivar enlace');
    }
  };

  const handleChangePermission = async (userId: string, newPermissionLevel: string) => {
    try {
      // Primero necesitamos obtener el ID del permiso
      const response = await api.get(`/api/sharing/document/${documentId}/permissions`);
      const permissions = response.data;
      const permission = permissions.find((p: { userId: string }) => p.userId === userId)

      if (!permission) {
        setError('No se encontró el permiso para este usuario');
        return;
      }

      await api.patch(`/api/sharing/permissions/${permission.id}`, {
        permissionLevel: newPermissionLevel,
      });
      
      setSuccess('Permiso actualizado exitosamente');
      fetchUsers();
      
      if (onPermissionsUpdated) {
        onPermissionsUpdated();
      }
    } catch (err: any) {
      console.error('Error updating permission:', err);
      setError(err?.response?.data?.message || 'Error al actualizar permiso');
    }
  };

  const getPermissionLabel = (level: string) => {
    switch (level) {
      case 'viewer': return 'Lector';
      case 'commenter': return 'Comentarista';
      case 'editor': return 'Editor';
      case 'owner': return 'Propietario';
      default: return level;
    }
  };

  const copyLinkToClipboard = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
        .then(() => {
          // Mostrar notificación visual temporal
          const linkInput = document.getElementById('share-link-input');
          if (linkInput) {
            linkInput.classList.add('bg-green-50', 'border-green-500');
            setTimeout(() => {
              linkInput.classList.remove('bg-green-50', 'border-green-500');
            }, 2000);
          }
          setSuccess('Enlace copiado al portapapeles');
        })
        .catch(err => console.error('Error copying text: ', err));
    }
  };

  return (
    <div className="mt-6">
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Compartición de Documento</h3>
          {canShare && (
            <div className="flex space-x-2">
              <Button
                onClick={() => setShowLinkModal(true)}
                variant="secondary"
                size="small"
              >
                Crear Enlace
              </Button>
              <Button
                onClick={() => setShowShareModal(true)}
                variant="primary"
                size="small"
              >
                Compartir
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-md bg-red-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="p-4 mb-4 rounded-md bg-green-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Usuarios con acceso */}
        <div className="mt-6">
          <h4 className="mb-2 font-medium text-gray-900 text-md">Usuarios con acceso</h4>
          {users.length === 0 ? (
            <p className="text-sm text-gray-500">No hay usuarios con acceso a este documento</p>
          ) : (
            <div className="overflow-hidden bg-white border border-gray-200 rounded-md">
              <ul className="divide-y divide-gray-200">
                {users.map((user) => (
                  <li key={user.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                            <span className="font-medium text-blue-800">
                              {user.name?.substring(0, 2).toUpperCase() || 'U'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.expiresAt && (
                            <div className="text-xs text-gray-400">
                              Expira: {new Date(user.expiresAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {canShare && !user.isOwner && (
                          <>
                            <select
                              value={user.permissionLevel}
                              onChange={(e) => handleChangePermission(user.id, e.target.value)}
                              className="block px-3 py-2 mr-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                              <option value="viewer">Lector</option>
                              <option value="commenter">Comentarista</option>
                              <option value="editor">Editor</option>
                              <option value="owner">Propietario</option>
                            </select>
                            
                            <button
                              onClick={() => handleRevokeAccess(user.id)}
                              className="inline-flex items-center p-1 ml-2 text-red-600 border border-transparent rounded-full hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </>
                        )}
                        {(!canShare || user.isOwner) && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getPermissionLabel(user.permissionLevel)}
                            {user.isOwner && ' (Propietario)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Enlaces de compartición */}
        {shareLinks.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 font-medium text-gray-900 text-md">Enlaces de compartición</h4>
            <div className="overflow-hidden bg-white border border-gray-200 rounded-md">
              <ul className="divide-y divide-gray-200">
                {shareLinks.map((link) => (
                  <li key={link.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium text-gray-900 break-all">
                            {`${window.location.origin}/share/${link.token}`}
                          </span>
                        </div>
                        <div className="flex items-center mt-1 text-xs text-gray-500">
                          <span className="mr-2">
                            {getPermissionLabel(link.permissionLevel)}
                          </span>
                          <span className="mx-1">•</span>
                          <span className="mr-2">
                            Expira: {new Date(link.expiresAt).toLocaleDateString()}
                          </span>
                          <span className="mx-1">•</span>
                          <span>
                            Accesos: {link.accessCount}
                          </span>
                          {link.requiresPassword && (
                            <>
                              <span className="mx-1">•</span>
                              <span className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Protegido
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex ml-4">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`);
                            setSuccess('Enlace copiado al portapapeles');
                          }}
                          className="p-1 mr-1 text-gray-400 hover:text-gray-500"
                          title="Copiar enlace"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        </button>
                        {link.isActive && canShare && (
                          <button
                            onClick={() => handleDeactivateLink(link.id)}
                            className="p-1 text-red-400 hover:text-red-500"
                            title="Desactivar enlace"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                        {!link.isActive && (
                          <span className="inline-flex items-center ml-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Modal para compartir por email */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="w-full max-w-md p-8 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Compartir "{documentTitle}"</h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Cerrar</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEmailShare}>
              <div className="mb-4">
                <label htmlFor="email" className="block mb-1 text-sm font-medium text-gray-700">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="ejemplo@correo.com"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="permission" className="block mb-1 text-sm font-medium text-gray-700">
                  Nivel de permiso
                </label>
                <select
                  id="permission"
                  value={permissionLevel}
                  onChange={(e) => setPermissionLevel(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="viewer">Lector - Puede ver el documento</option>
                  <option value="commenter">Comentarista - Puede comentar</option>
                  <option value="editor">Editor - Puede modificar</option>
                  <option value="owner">Propietario - Control total</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="expiration" className="block mb-1 text-sm font-medium text-gray-700">
                  Fecha de expiración (opcional)
                </label>
                <input
                  id="expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="mb-4">
                <label htmlFor="message" className="block mb-1 text-sm font-medium text-gray-700">
                  Mensaje (opcional)
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Mensaje para el destinatario"
                ></textarea>
              </div>

              <div className="flex justify-end mt-6 space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowShareModal(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading || !email}
                >
                  {isLoading ? 'Compartiendo...' : 'Compartir'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para crear enlaces */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="w-full max-w-md p-8 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">Crear enlace de compartición</h3>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setShareLink(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Cerrar</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {shareLink ? (
              <div>
                <div className="p-4 mb-4 rounded-md bg-gray-50">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Enlace de compartición
                  </label>
                  <div className="flex mt-1">
                    <input
                      id="share-link-input"
                      readOnly
                      value={shareLink}
                      className="block w-full transition-colors duration-200 border-gray-300 rounded-md rounded-r-none shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={copyLinkToClipboard}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                      Copiar
                    </button>
                  </div>
                </div>

                <p className="mb-4 text-sm text-gray-500">
                  Cualquier persona con este enlace podrá acceder al documento con el nivel de permiso especificado.
                </p>

                <div className="flex justify-end space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowLinkModal(false);
                      setShareLink(null);
                    }}
                  >
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setShareLink(null);
                      setRequirePassword(false);
                      setPassword('');
                      setMaxUses('');
                      setPermissionLevel('viewer');
                      setExpirationDate('');
                    }}
                  >
                    Crear otro enlace
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateShareLink}>
                <div className="mb-4">
                  <label htmlFor="linkPermission" className="block mb-1 text-sm font-medium text-gray-700">
                    Nivel de permiso
                  </label>
                  <select
                    id="linkPermission"
                    value={permissionLevel}
                    onChange={(e) => setPermissionLevel(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="viewer">Lector - Puede ver el documento</option>
                    <option value="commenter">Comentarista - Puede comentar</option>
                    <option value="editor">Editor - Puede modificar</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label htmlFor="linkExpiration" className="block mb-1 text-sm font-medium text-gray-700">
                    Fecha de expiración
                  </label>
                  <input
                    id="linkExpiration"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="maxUses" className="block mb-1 text-sm font-medium text-gray-700">
                    Número máximo de usos (opcional)
                  </label>
                  <input
                    id="maxUses"
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    min="1"
                    placeholder="Sin límite"
                  />
                </div>

                <div className="mb-4">
                  <div className="flex items-center">
                    <input
                      id="requirePassword"
                      type="checkbox"
                      checked={requirePassword}
                      onChange={(e) => setRequirePassword(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="requirePassword" className="block ml-2 text-sm text-gray-900">
                      Proteger con contraseña
                    </label>
                  </div>
                </div>

                {requirePassword && (
                  <div className="mb-4 ml-6">
                    <label htmlFor="password" className="block mb-1 text-sm font-medium text-gray-700">
                      Contraseña
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required={requirePassword}
                      minLength={4}
                    />
                  </div>
                )}

                <div className="flex justify-end mt-6 space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowLinkModal(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading || !expirationDate || (requirePassword && !password)}
                  >
                    {isLoading ? 'Creando...' : 'Crear enlace'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentSharing;