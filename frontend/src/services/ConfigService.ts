import { api } from '../api/client';
import { SystemHealthData, SecurityEvent, RecentUser } from '../types/admin';

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

// Interfaz para el estado de salud del sistema
export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    email: {
      status: 'up' | 'down' | 'warning';
      lastChecked: string;
    };
    blockchain: {
      status: 'up' | 'down' | 'warning';
      lastChecked: string;
    };
    database: {
      status: 'up' | 'down' | 'warning';
      lastChecked: string;
    };
  };
  resources: {
    storage: {
      total: number;
      used: number;
      available: number;
    };
    users: {
      total: number;
      active: number;
    };
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

  // Obtener estado de salud del sistema
  async getSystemHealth(): Promise<SystemHealthData> {
    try {
      const response = await api.get('/api/admin/system-health');
      return response.data;
    } catch (error: any) {
      console.error('Error al obtener estado de salud del sistema:', error);

      // Si no podemos contactar con el servidor, devolvemos un estado de salud de "unhealthy"
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          services: {
            email: { status: 'down', lastChecked: new Date().toISOString() },
            blockchain: {
              status: 'down',
              lastChecked: new Date().toISOString(),
            },
            database: { status: 'down', lastChecked: new Date().toISOString() },
          },
          resources: {
            storage: { total: 0, used: 0, available: 0 },
            users: { total: 0, active: 0 },
          },
        };
      }

      throw error;
    }
  },

  // Obtener la lista de usuarios recientes
  async getRecentUsers(): Promise<RecentUser[]> {
    try {
      const response = await api.get('/api/admin/recent-users');
      return response.data;
    } catch (error) {
      console.error('Error al obtener usuarios recientes:', error);
      throw error;
    }
  },

  // Obtener eventos de seguridad
  async getSecurityEvents(): Promise<SecurityEvent[]> {
    try {
      const response = await api.get('/api/admin/security-events');
      return response.data;
    } catch (error) {
      console.error('Error al obtener eventos de seguridad:', error);
      throw error;
    }
  },
};

export default configService;
