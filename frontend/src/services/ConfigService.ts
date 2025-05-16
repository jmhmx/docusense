import { api } from '../api/client';

// Definición de la interfaz del sistema de configuración
export interface SystemConfig {
  email: {
    fromEmail: string;
    smtpServer: string;
    smtpPort: number;
    useSSL: boolean;
    username: string;
    password?: string;
  };
  security: {
    jwtExpirationHours: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    requireStrongPasswords: boolean;
    twoFactorAuthEnabled: boolean;
    keyRotationDays: number;
  };
  storage: {
    maxFileSizeMB: number;
    totalStorageGB: number;
    allowedFileTypes: string[];
    documentExpirationDays: number;
  };
  blockchain: {
    enabled: boolean;
    provider: string;
    apiKey?: string;
    networkId: string;
  };
}

export const configService = {
  // Obtener la configuración completa del sistema
  async getConfiguration(): Promise<SystemConfig> {
    try {
      const response = await api.get('/api/admin/configuration');
      return response.data;
    } catch (error) {
      console.error('Error al obtener configuración:', error);
      throw error;
    }
  },

  // Actualizar toda la configuración del sistema
  async updateConfiguration(config: SystemConfig): Promise<SystemConfig> {
    try {
      const response = await api.put('/api/admin/configuration', config);
      return response.data;
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      throw error;
    }
  },

  // Actualizar una sección específica de la configuración
  async updateConfigSection(
    section: keyof SystemConfig,
    sectionData: any,
  ): Promise<SystemConfig> {
    try {
      const data = { [section]: sectionData };
      const response = await api.put('/api/admin/configuration', data);
      return response.data;
    } catch (error) {
      console.error(`Error al actualizar sección ${section}:`, error);
      throw error;
    }
  },

  // Restablecer una sección a valores predeterminados
  async resetToDefaults(section: keyof SystemConfig): Promise<SystemConfig> {
    try {
      const response = await api.post(
        `/api/admin/configuration/reset/${section}`,
      );
      return response.data;
    } catch (error) {
      console.error(`Error al restablecer sección ${section}:`, error);
      throw error;
    }
  },

  // Probar la configuración de correo
  async testEmailConfiguration(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await api.post('/api/admin/configuration/test-email');
      return response.data;
    } catch (error: any) {
      console.error('Error al probar configuración de email:', error);
      return {
        success: false,
        message:
          error.response?.data?.message ||
          'Error al probar la configuración de correo',
      };
    }
  },

  // Probar la configuración de blockchain
  async testBlockchainConnection(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await api.post(
        '/api/admin/configuration/test-blockchain',
      );
      return response.data;
    } catch (error: any) {
      console.error('Error al probar conexión blockchain:', error);
      return {
        success: false,
        message:
          error.response?.data?.message ||
          'Error al probar la conexión con blockchain',
      };
    }
  },

  // Obtener estadísticas del sistema
  async getSystemStats(): Promise<any> {
    try {
      const response = await api.get('/api/admin/stats');
      return response.data;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      throw error;
    }
  },
};

export default configService;
