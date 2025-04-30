// src/components/MultiSignatureManager.tsx

import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Button from './Button';
import useAuth from '../hooks/UseAuth';

// Mejora de la interfaz para incluir todos los tipos necesarios
interface User {
  id: string;
  name: string;
  email: string;
}

interface MultiSignatureManagerProps {
  documentId: string;
  documentTitle: string;
  onUpdate: () => void;
}

const MultiSignatureManager = ({ documentId, documentTitle, onUpdate }: MultiSignatureManagerProps) => {
  const { user: currentUser } = useAuth();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [requiredSigners, setRequiredSigners] = useState<number>(0);
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<any>(null);

  useEffect(() => {
    checkOwnership();
    fetchDocumentStatus();
  }, [documentId]);

  const checkOwnership = async () => {
    try {
      const response = await api.get(`/api/documents/${documentId}/permissions`);
      setIsOwner(response.data.isOwner || false);
    } catch (err) {
      console.error('Error verificando propiedad:', err);
    }
  };

  const fetchDocumentStatus = async () => {
    try {
      const response = await api.get(`/api/documents/${documentId}/signature-status`);
      setDocumentStatus(response.data);
      
      // Si ya hay un proceso iniciado, cargar los firmantes seleccionados
      if (response.data.multiSignatureProcess) {
        const usersResponse = await api.get('/api/users/available-signers');
        const allUsers = usersResponse.data;
        
        // Filtrar usuarios ya seleccionados
        const signers = allUsers.filter((user: User) => 
          response.data.pendingSigners.includes(user.id) || 
          response.data.completedSigners?.includes(user.id)
        );
        
        setSelectedUsers(signers);
        setRequiredSigners(response.data.requiredSigners || signers.length);
      }
    } catch (err) {
      console.error('Error obteniendo estado de firmas:', err);
    }
  };

  const loadAvailableUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/users/available-signers');
      setAvailableUsers(response.data);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setError('No se pudieron cargar los usuarios disponibles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (user: User) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const initiateMultiSignatureProcess = async () => {
    if (selectedUsers.length === 0) {
      setError('Debe seleccionar al menos un firmante');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await api.post(`/api/signatures/${documentId}/multi-init`, {
        signerIds: selectedUsers.map(u => u.id),
        requiredSigners: requiredSigners || selectedUsers.length
      });
      
      setSuccess('Proceso de firmas múltiples iniciado correctamente');
      setShowUserSelector(false);
      fetchDocumentStatus();
      onUpdate();
    } catch (err: any) {
      console.error('Error iniciando firmas múltiples:', err);
      setError(err?.response?.data?.message || 'Error iniciando proceso de firmas múltiples');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelMultiSignatureProcess = async () => {
    if (!confirm('¿Está seguro de cancelar el proceso de firmas múltiples?')) return;
    
    setIsLoading(true);
    try {
      await api.post(`/api/signatures/${documentId}/multi-cancel`);
      setSuccess('Proceso de firmas múltiples cancelado');
      fetchDocumentStatus();
      onUpdate();
    } catch (err: any) {
      console.error('Error cancelando proceso:', err);
      setError(err?.response?.data?.message || 'Error cancelando proceso');
    } finally {
      setIsLoading(false);
    }
  };

  const openUserSelector = () => {
    loadAvailableUsers();
    setShowUserSelector(true);
  };

  const getSignerStatus = (userId: string) => {
    if (documentStatus?.completedSigners?.includes(userId)) {
      return <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">Firmado</span>;
    } else {
      return <span className="px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">Pendiente</span>;
    }
  };

  // Calcular porcentaje de progreso
  const calculateProgress = () => {
    if (!documentStatus?.multiSignatureProcess) return 0;
    
    const completedCount = documentStatus.completedSigners?.length || 0;
    const requiredCount = documentStatus.requiredSigners || 1;
    
    return Math.min(Math.round((completedCount / requiredCount) * 100), 100);
  };

  return (
    <div className="p-6 mt-6 bg-white rounded-lg shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">Firmas Múltiples</h3>

      {error && (
        <div className="p-4 mb-4 border-l-4 border-red-400 bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 mb-4 border-l-4 border-green-400 bg-green-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {documentStatus?.multiSignatureProcess ? (
        <div>
          <div className="p-4 mb-4 rounded-md bg-blue-50">
            <h4 className="mb-2 font-medium text-blue-700">Proceso de firmas múltiples activo</h4>
            <p className="text-sm text-blue-600">
              Iniciado el {new Date(documentStatus.initiatedAt).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-blue-600">
              Firmas requeridas: {documentStatus.requiredSigners} de {documentStatus.totalSigners}
            </p>
            <p className="mt-1 text-sm text-blue-600">
              Firmas completadas: {documentStatus.completedSigners?.length || 0}
            </p>
            
            {/* Barra de progreso */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span>{documentStatus.completedSigners?.length || 0} de {documentStatus.requiredSigners} firmas</span>
                <span>{calculateProgress()}% completado</span>
              </div>
              <div className="w-full h-2 mt-1 bg-blue-200 rounded-full">
                <div 
                  className="h-2 bg-blue-600 rounded-full"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
            </div>
            
            {documentStatus.isComplete && (
              <div className="p-2 mt-3 text-sm font-medium text-green-800 bg-green-100 rounded">
                ✓ Quórum alcanzado. Documento válidamente firmado.
              </div>
            )}
          </div>

          <div className="mt-4">
            <h4 className="mb-2 font-medium text-gray-700">Firmantes:</h4>
            <ul className="border divide-y divide-gray-200 rounded-md">
              {selectedUsers.map((signer) => (
                <li key={signer.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{signer.name}</p>
                    <p className="text-xs text-gray-500">{signer.email}</p>
                  </div>
                  <div>
                    {getSignerStatus(signer.id)}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {isOwner && (
            <div className="mt-4">
              <Button 
                onClick={cancelMultiSignatureProcess} 
                variant="danger"
                disabled={isLoading}
              >
                {isLoading ? 'Procesando...' : 'Cancelar proceso de firmas'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {isOwner ? (
            <div>
              <p className="mb-4 text-gray-600">
                Puede iniciar un proceso de firmas múltiples para este documento.
                Esto permite que varios usuarios firmen el documento secuencialmente o en paralelo.
              </p>
              <Button 
                onClick={openUserSelector} 
                variant="primary"
              >
                Iniciar proceso de firmas múltiples
              </Button>
            </div>
          ) : (
            <p className="text-gray-600">
              Solo el propietario del documento puede iniciar un proceso de firmas múltiples.
            </p>
          )}
        </div>
      )}

      {/* Modal de selección de usuarios */}
      {showUserSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Seleccionar firmantes para { documentTitle}</h3>
              <button 
                onClick={() => setShowUserSelector(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <svg className="w-8 h-8 text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <>
                <div className="mb-4 overflow-y-auto max-h-60">
                  <ul className="divide-y divide-gray-200">
                    {availableUsers.filter(u => u.id !== currentUser?.id).map((user) => (
                      <li key={user.id} className="py-2">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            checked={!!selectedUsers.find(u => u.id === user.id)}
                            onChange={() => handleUserSelect(user)}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-4">
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Firmas requeridas para validez (quórum)
                  </label>
                  <select
                    value={requiredSigners}
                    onChange={(e) => setRequiredSigners(Number(e.target.value))}
                    className="block w-full py-2 pl-3 pr-10 text-base border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={selectedUsers.length === 0}
                  >
                    {[...Array(selectedUsers.length || 1).keys()].map(num => (
                      <option key={num + 1} value={num + 1}>
                        {num + 1} {num + 1 === 1 ? 'firmante' : 'firmantes'}
                        {num + 1 === selectedUsers.length ? ' (todos)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    El documento será válido cuando alcance este número de firmas
                  </p>
                </div>

                <div className="flex justify-end mt-5 space-x-3">
                  <Button
                    onClick={() => setShowUserSelector(false)}
                    variant="secondary"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={initiateMultiSignatureProcess}
                    disabled={selectedUsers.length === 0 || isLoading}
                    variant="primary"
                  >
                    {isLoading ? 'Iniciando...' : 'Iniciar proceso'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSignatureManager;