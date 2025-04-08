import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Button from '../components/Button';
import Input from '../components/Input';
import useAuth from '../hooks/UseAuth';

interface ShareLink {
  isValid: boolean;
  requiresPassword: boolean;
  documentTitle: string;
  permissionLevel: string;
  expiresAt: string;
  message?: string;
}

interface DocumentInfo {
  id: string;
  title: string;
  permissionLevel: string;
}

const SharedDocumentView = () => {
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [linkInfo, setLinkInfo] = useState<ShareLink | null>(null);
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    
    const fetchLinkInfo = async () => {
      try {
        const response = await api.get(`/api/sharing/link/info/${token}`);
        setLinkInfo(response.data);
      } catch (err: any) {
        console.error('Error fetching share link info:', err);
        setError('Error al cargar información del enlace');
      } finally {
        setLoading(false);
      }
    };

    fetchLinkInfo();
  }, [token]);

  const handleAccessDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setAccessLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/api/sharing/link/access', {
        token,
        password: linkInfo?.requiresPassword ? password : undefined,
      });
      
      setDocumentInfo({
        id: response.data.document.id,
        title: response.data.document.title,
        permissionLevel: response.data.permissionLevel,
      });
      
      // Redirigir al documento después de 2 segundos
      setTimeout(() => {
        navigate(`/documents/${response.data.document.id}`);
      }, 2000);
    } catch (err: any) {
      console.error('Error accessing document:', err);
      setError(err?.response?.data?.message || 'Error al acceder al documento');
    } finally {
      setAccessLoading(false);
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

  if (loading) {
    return (
      <div className="flex flex-col justify-center min-h-screen py-12 bg-gray-50 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="px-4 py-8 bg-white shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="mt-2 text-xl font-medium text-gray-900">Enlace no válido</h3>
              <p className="mt-1 text-sm text-gray-500">
                {linkInfo?.message || 'Este enlace ha expirado o no es válido.'}
              </p>
              <div className="mt-5">
                <Button onClick={() => navigate('/')} fullWidth>
                  Volver al inicio
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (documentInfo) {
    return (
      <div className="flex flex-col justify-center min-h-screen py-12 bg-gray-50 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="px-4 py-8 bg-white shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="mt-2 text-xl font-medium text-gray-900">Acceso concedido</h3>
              <p className="mt-1 text-sm text-gray-500">
                Ahora tienes acceso a <strong>{documentInfo.title}</strong> con permisos de <strong>{getPermissionLabel(documentInfo.permissionLevel)}</strong>.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Serás redirigido en unos segundos...
              </p>
              <div className="mt-5">
                <Button 
                  onClick={() => navigate(`/documents/${documentInfo.id}`)} 
                  fullWidth
                >
                  Ver documento ahora
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center min-h-screen py-12 bg-gray-50 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="mt-6 text-3xl font-bold text-center text-gray-900">
            Documento compartido
          </h2>
          <p className="mt-2 text-sm text-center text-gray-600">
            Has sido invitado a acceder a:
          </p>
          <p className="mt-1 font-medium text-blue-600">
            {linkInfo?.documentTitle}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="px-4 py-8 bg-white shadow sm:rounded-lg sm:px-10">
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

          <form className="space-y-6" onSubmit={handleAccessDocument}>
            <div>
              <p className="text-sm text-gray-700">
                Tendrás acceso con nivel de permisos: <strong>{getPermissionLabel(linkInfo?.permissionLevel || 'viewer')}</strong>
              </p>
              <p className="mt-2 text-sm text-gray-700">
                Este enlace expira el: <strong>{new Date(linkInfo?.expiresAt || '').toLocaleDateString()}</strong>
              </p>
            </div>

            {linkInfo?.requiresPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Este documento está protegido con contraseña
                </label>
                <div className="mt-1">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Introduzca la contraseña"
                    fullWidth
                  />
                </div>
              </div>
            )}

            {!isAuthenticated && (
              <div className="p-4 rounded-md bg-yellow-50">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Aviso</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        No has iniciado sesión. Para interactuar con el documento, te recomendamos <a href="/login" className="font-medium underline hover:text-yellow-600">iniciar sesión</a> o <a href="/register" className="font-medium underline hover:text-yellow-600">registrarte</a>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Button
                type="submit"
                fullWidth
                disabled={accessLoading || (linkInfo?.requiresPassword && !password)}
              >
                {accessLoading ? 'Accediendo...' : 'Acceder al documento'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
  
export default SharedDocumentView;