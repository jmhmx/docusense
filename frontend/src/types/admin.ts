// src/types/admin.ts

export interface ServiceStatus {
  status: 'up' | 'down' | 'warning';
  lastChecked: string;
}

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    email: ServiceStatus;
    blockchain: ServiceStatus;
    database: ServiceStatus;
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

export interface SecurityEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  ipAddress?: string;
  userId?: string;
  resourceId?: string;
}

export interface RecentUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  lastActivity?: string;
  documentsCount?: number;
}

export interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}
