import { useState, useEffect } from 'react';
import Button from '../components/Button';
import Input from '../components/Input';
import configService, { SystemConfig } from '../services/ConfigService';

// Componente principal
const ConfigurationPanel = () => {
  // Estados
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [activeTab, setActiveTab] = useState<
    'email' | 'security' | 'storage' | 'blockchain'
  >('email');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Cargar configuración al iniciar
  useEffect(() => {
    fetchConfiguration();
  }, []);

  // Función para cargar la configuración
  const fetchConfiguration = async () => {
    setIsLoading(true);
    setError('');

    try {
      const configData = await configService.getConfiguration();
      setConfig(configData);
    } catch (err: any) {
      console.error('Error cargando configuración:', err);
      setError(
        err.response?.data?.message ||
          'No se pudo cargar la configuración del sistema. Por favor, inténtalo más tarde.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Función para guardar la configuración
  const saveConfiguration = async () => {
    if (!config) return;

    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await configService.updateConfiguration(config);
      setSuccessMessage('Configuración guardada correctamente');

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      console.error('Error guardando configuración:', err);
      setError(
        err.response?.data?.message || 'Error al guardar la configuración',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Función para actualizar valores de configuración
  const updateConfig = (
    section: keyof SystemConfig,
    field: string,
    value: any,
  ) => {
    if (!config) return;

    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: value,
      },
    });
  };

  // Función para resetear a valores predeterminados
  const resetToDefaults = async (section: keyof SystemConfig) => {
    if (
      !window.confirm(
        `¿Estás seguro de que deseas restablecer la sección ${section} a los valores predeterminados?`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const updatedConfig = await configService.resetToDefaults(section);

      // Actualizar estado local con los datos actualizados
      setConfig(updatedConfig);

      setSuccessMessage(
        `Configuración de ${section} restablecida correctamente`,
      );

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      console.error('Error reseteando configuración:', err);
      setError(
        err.response?.data?.message || 'Error al restablecer la configuración',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Funciones para probar la configuración
  const testEmailConfiguration = async () => {
    setIsTesting(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await configService.testEmailConfiguration();
      if (result.success) {
        setSuccessMessage(
          result.message ||
            'Correo de prueba enviado correctamente. Verifica tu bandeja de entrada.',
        );
      } else {
        setError(result.message || 'Error al enviar correo de prueba');
      }

      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 5000);
    } catch (err: any) {
      console.error('Error enviando correo de prueba:', err);
      setError(
        err.response?.data?.message || 'Error al enviar correo de prueba',
      );
    } finally {
      setIsTesting(false);
    }
  };

  const testBlockchainConnection = async () => {
    setIsTesting(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await configService.testBlockchainConnection();
      if (result.success) {
        setSuccessMessage(
          result.message || 'Conexión con blockchain establecida correctamente',
        );
      } else {
        setError(result.message || 'Error al conectar con blockchain');
      }

      setTimeout(() => {
        setSuccessMessage('');
        setError('');
      }, 3000);
    } catch (err: any) {
      console.error('Error probando conexión blockchain:', err);
      setError(
        err.response?.data?.message || 'Error al conectar con blockchain',
      );
    } finally {
      setIsTesting(false);
    }
  };

  // Renderizado de componente en estado de carga
  if (isLoading && !config) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <div className='flex flex-col items-center'>
          <svg
            className='w-12 h-12 text-blue-500 animate-spin'
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
          <p className='mt-4 text-lg font-medium text-gray-700'>
            Cargando configuración...
          </p>
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className='p-6 bg-white rounded-lg shadow'>
        <div className='p-4 mb-4 rounded-md bg-red-50'>
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
              <h3 className='text-sm font-medium text-red-800'>{error}</h3>
              <div className='mt-4'>
                <Button onClick={fetchConfiguration}>Reintentar</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizado principal
  return (
    <div className='p-6 bg-white rounded-lg shadow'>
      <div className='mb-6'>
        <h2 className='text-lg font-medium text-gray-900'>
          Configuración del Sistema
        </h2>
        <p className='mt-1 text-sm text-gray-500'>
          Gestiona la configuración de correo electrónico, seguridad,
          almacenamiento y blockchain.
        </p>
      </div>

      {/* Mensajes de éxito y error */}
      {successMessage && (
        <div className='p-4 mb-4 border-l-4 border-green-500 bg-green-50'>
          <div className='flex'>
            <div className='flex-shrink-0'>
              <svg
                className='w-5 h-5 text-green-400'
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
            </div>
            <div className='ml-3'>
              <p className='text-sm text-green-700'>{successMessage}</p>
            </div>
          </div>
        </div>
      )}

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
            </div>
          </div>
        </div>
      )}

      {/* Pestañas de navegación */}
      <div className='mb-6 border-b border-gray-200'>
        <nav className='flex -mb-px space-x-8'>
          <button
            onClick={() => setActiveTab('email')}
            className={`pb-4 text-sm font-medium border-b-2 ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            Correo Electrónico
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`pb-4 text-sm font-medium border-b-2 ${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            Seguridad
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`pb-4 text-sm font-medium border-b-2 ${
              activeTab === 'storage'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            Almacenamiento
          </button>
          <button
            onClick={() => setActiveTab('blockchain')}
            className={`pb-4 text-sm font-medium border-b-2 ${
              activeTab === 'blockchain'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            Blockchain
          </button>
        </nav>
      </div>

      {/* Contenido según la pestaña activa */}
      {config && (
        <div>
          {/* Configuración de Correo Electrónico */}
          {activeTab === 'email' && (
            <div className='space-y-6'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <Input
                  label='Dirección de correo (From)'
                  value={config.email.fromEmail}
                  onChange={(e) =>
                    updateConfig('email', 'fromEmail', e.target.value)
                  }
                  fullWidth
                />
                <Input
                  label='Servidor SMTP'
                  value={config.email.smtpServer}
                  onChange={(e) =>
                    updateConfig('email', 'smtpServer', e.target.value)
                  }
                  fullWidth
                />
                <Input
                  label='Puerto SMTP'
                  type='number'
                  value={config.email.smtpPort}
                  onChange={(e) =>
                    updateConfig('email', 'smtpPort', parseInt(e.target.value))
                  }
                  fullWidth
                />
                <div className='flex items-center mt-6'>
                  <input
                    id='useSSL'
                    type='checkbox'
                    checked={config.email.useSSL}
                    onChange={(e) =>
                      updateConfig('email', 'useSSL', e.target.checked)
                    }
                    className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                  />
                  <label
                    htmlFor='useSSL'
                    className='block ml-2 text-sm text-gray-900'>
                    Usar SSL/TLS
                  </label>
                </div>
                <Input
                  label='Nombre de usuario SMTP'
                  value={config.email.username}
                  onChange={(e) =>
                    updateConfig('email', 'username', e.target.value)
                  }
                  fullWidth
                />
                <Input
                  label='Contraseña SMTP'
                  type='password'
                  value={config.email.password || ''}
                  onChange={(e) =>
                    updateConfig('email', 'password', e.target.value)
                  }
                  placeholder='••••••••'
                  fullWidth
                />
              </div>

              <div className='flex mt-6 space-x-4'>
                <Button
                  onClick={testEmailConfiguration}
                  variant='secondary'
                  disabled={isSaving || isLoading || isTesting}>
                  {isTesting ? 'Probando...' : 'Probar configuración'}
                </Button>
                <Button
                  onClick={() => resetToDefaults('email')}
                  variant='danger'
                  disabled={isSaving || isLoading || isTesting}>
                  Restaurar valores predeterminados
                </Button>
              </div>
            </div>
          )}

          {/* Configuración de Seguridad */}
          {activeTab === 'security' && (
            <div className='space-y-6'>
              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <Input
                  label='Expiración de JWT (horas)'
                  type='number'
                  min='1'
                  value={config.security.jwtExpirationHours}
                  onChange={(e) =>
                    updateConfig(
                      'security',
                      'jwtExpirationHours',
                      parseInt(e.target.value),
                    )
                  }
                  fullWidth
                />
                <Input
                  label='Máx. intentos de inicio de sesión'
                  type='number'
                  min='1'
                  value={config.security.maxLoginAttempts}
                  onChange={(e) =>
                    updateConfig(
                      'security',
                      'maxLoginAttempts',
                      parseInt(e.target.value),
                    )
                  }
                  fullWidth
                />
                <Input
                  label='Longitud mínima de contraseña'
                  type='number'
                  min='6'
                  value={config.security.passwordMinLength}
                  onChange={(e) =>
                    updateConfig(
                      'security',
                      'passwordMinLength',
                      parseInt(e.target.value),
                    )
                  }
                  fullWidth
                />
                <Input
                  label='Días para rotación de claves'
                  type='number'
                  min='30'
                  value={config.security.keyRotationDays}
                  onChange={(e) =>
                    updateConfig(
                      'security',
                      'keyRotationDays',
                      parseInt(e.target.value),
                    )
                  }
                  fullWidth
                />

                <div className='flex items-center'>
                  <input
                    id='requireStrongPasswords'
                    type='checkbox'
                    checked={config.security.requireStrongPasswords}
                    onChange={(e) =>
                      updateConfig(
                        'security',
                        'requireStrongPasswords',
                        e.target.checked,
                      )
                    }
                    className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                  />
                  <label
                    htmlFor='requireStrongPasswords'
                    className='block ml-2 text-sm text-gray-900'>
                    Requerir contraseñas fuertes
                  </label>
                </div>
                <div className='flex items-center'>
                  <input
                    id='twoFactorAuthEnabled'
                    type='checkbox'
                    checked={config.security.twoFactorAuthEnabled}
                    onChange={(e) =>
                      updateConfig(
                        'security',
                        'twoFactorAuthEnabled',
                        e.target.checked,
                      )
                    }
                    className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                  />
                  <label
                    htmlFor='twoFactorAuthEnabled'
                    className='block ml-2 text-sm text-gray-900'>
                    Habilitar autenticación de dos factores
                  </label>
                </div>
              </div>

              <div className='p-4 mt-4 rounded-md bg-yellow-50'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <svg
                      className='w-5 h-5 text-yellow-400'
                      xmlns='http://www.w3.org/2000/svg'
                      viewBox='0 0 20 20'
                      fill='currentColor'>
                      <path
                        fillRule='evenodd'
                        d='M8.257 3.099c.765-1.36 2.924-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <div className='ml-3'>
                    <h3 className='text-sm font-medium text-yellow-800'>
                      Atención
                    </h3>
                    <div className='mt-2 text-sm text-yellow-700'>
                      <p>
                        Cambiar algunas configuraciones de seguridad puede
                        cerrar las sesiones activas de los usuarios.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='flex mt-6 space-x-4'>
                <Button
                  onClick={() => resetToDefaults('security')}
                  variant='danger'
                  disabled={isSaving || isLoading}>
                  Restaurar valores predeterminados
                </Button>
              </div>
            </div>
          )}

          {/* Configuración de Almacenamiento */}
          {activeTab === 'storage' && (
            <div className='space-y-6'>
              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <Input
                  label='Tamaño máximo de archivo (MB)'
                  type='number'
                  min='1'
                  value={config.storage.maxFileSizeMB}
                  onChange={(e) =>
                    updateConfig(
                      'storage',
                      'maxFileSizeMB',
                      parseInt(e.target.value),
                    )
                  }
                  fullWidth
                />
                <Input
                  label='Almacenamiento total (GB)'
                  type='number'
                  min='1'
                  value={config.storage.totalStorageGB}
                  onChange={(e) =>
                    updateConfig(
                      'storage',
                      'totalStorageGB',
                      parseInt(e.target.value),
                    )
                  }
                  fullWidth
                />
                <Input
                  label='Expiración de documentos (días, 0 = nunca)'
                  type='number'
                  min='0'
                  value={config.storage.documentExpirationDays}
                  onChange={(e) =>
                    updateConfig(
                      'storage',
                      'documentExpirationDays',
                      parseInt(e.target.value),
                    )
                  }
                  fullWidth
                />

                <div className='col-span-2'>
                  <label className='block text-sm font-medium text-gray-700'>
                    Tipos de archivo permitidos
                  </label>
                  <div className='mt-2'>
                    <div className='flex flex-wrap gap-2'>
                      {config.storage.allowedFileTypes.map((type, index) => (
                        <div
                          key={index}
                          className='flex items-center px-3 py-1 text-sm bg-gray-100 rounded-full'>
                          <span>{type}</span>
                          <button
                            type='button'
                            onClick={() => {
                              const newTypes = [
                                ...config.storage.allowedFileTypes,
                              ];
                              newTypes.splice(index, 1);
                              updateConfig(
                                'storage',
                                'allowedFileTypes',
                                newTypes,
                              );
                            }}
                            className='ml-2 text-gray-500 hover:text-gray-700'>
                            <svg
                              xmlns='http://www.w3.org/2000/svg'
                              className='w-4 h-4'
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
                      ))}
                      <input
                        type='text'
                        placeholder='Añadir tipo (ej: .pdf)'
                        className='px-3 py-1 text-sm border-gray-300 rounded-md'
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const value = e.currentTarget.value.trim();
                            if (
                              value &&
                              !config.storage.allowedFileTypes.includes(value)
                            ) {
                              updateConfig('storage', 'allowedFileTypes', [
                                ...config.storage.allowedFileTypes,
                                value,
                              ]);
                              e.currentTarget.value = '';
                            }
                            e.preventDefault();
                          }
                        }}
                      />
                    </div>
                    <p className='mt-2 text-xs text-gray-500'>
                      Presiona Enter para añadir un nuevo tipo de archivo.
                      Ejemplos: .pdf, .docx, .jpg
                    </p>
                  </div>
                </div>
              </div>

              <div className='flex mt-6 space-x-4'>
                <Button
                  onClick={() => resetToDefaults('storage')}
                  variant='danger'
                  disabled={isSaving || isLoading}>
                  Restaurar valores predeterminados
                </Button>
              </div>
            </div>
          )}

          {/* Configuración de Blockchain */}
          {activeTab === 'blockchain' && (
            <div className='space-y-6'>
              <div className='flex items-center mb-6'>
                <input
                  id='blockchainEnabled'
                  type='checkbox'
                  checked={config.blockchain.enabled}
                  onChange={(e) =>
                    updateConfig('blockchain', 'enabled', e.target.checked)
                  }
                  className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                />
                <label
                  htmlFor='blockchainEnabled'
                  className='block ml-2 text-sm font-medium text-gray-900'>
                  Habilitar integración con blockchain
                </label>
              </div>

              {config.blockchain.enabled && (
                <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>
                      Proveedor
                    </label>
                    <select
                      value={config.blockchain.provider}
                      onChange={(e) =>
                        updateConfig('blockchain', 'provider', e.target.value)
                      }
                      className='block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm'>
                      <option value='ethereum'>Ethereum</option>
                      <option value='hyperledger'>Hyperledger Fabric</option>
                      <option value='polygon'>Polygon</option>
                    </select>
                  </div>

                  <Input
                    label='Clave API (si es necesario)'
                    type='password'
                    value={config.blockchain.apiKey || ''}
                    onChange={(e) =>
                      updateConfig('blockchain', 'apiKey', e.target.value)
                    }
                    placeholder='••••••••'
                    fullWidth
                  />

                  <Input
                    label='ID de red'
                    value={config.blockchain.networkId}
                    onChange={(e) =>
                      updateConfig('blockchain', 'networkId', e.target.value)
                    }
                    fullWidth
                  />
                </div>
              )}

              {config.blockchain.enabled && (
                <div className='p-4 mt-4 rounded-md bg-blue-50'>
                  <div className='flex'>
                    <div className='flex-shrink-0'>
                      <svg
                        className='w-5 h-5 text-blue-400'
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 20 20'
                        fill='currentColor'>
                        <path
                          fillRule='evenodd'
                          d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                          clipRule='evenodd'
                        />
                      </svg>
                    </div>
                    <div className='ml-3'>
                      <h3 className='text-sm font-medium text-blue-800'>
                        Información
                      </h3>
                      <div className='mt-2 text-sm text-blue-700'>
                        <p>
                          La integración con blockchain permite validar la
                          autenticidad e integridad de los documentos. Los
                          cambios en esta configuración solo afectarán a nuevos
                          documentos.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className='flex mt-6 space-x-4'>
                {config.blockchain.enabled && (
                  <Button
                    onClick={testBlockchainConnection}
                    variant='secondary'
                    disabled={isSaving || isLoading || isTesting}>
                    {isTesting ? 'Probando...' : 'Probar conexión'}
                  </Button>
                )}
                <Button
                  onClick={() => resetToDefaults('blockchain')}
                  variant='danger'
                  disabled={isSaving || isLoading}>
                  Restaurar valores predeterminados
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botones de acción */}
      <div className='flex justify-end mt-8 space-x-4'>
        <Button
          onClick={fetchConfiguration}
          variant='secondary'
          disabled={isSaving}>
          Cancelar cambios
        </Button>
        <Button
          onClick={saveConfiguration}
          disabled={isLoading || isSaving}>
          {isSaving ? (
            <span className='flex items-center'>
              <svg
                className='w-4 h-4 mr-2 animate-spin'
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
              Guardando...
            </span>
          ) : (
            'Guardar configuración'
          )}
        </Button>
      </div>
    </div>
  );
};

export default ConfigurationPanel;
