import React from 'react';

interface DocumentStatusBadgeProps {
  status: string;
  className?: string;
}

// Función para traducir el estado al español
const translateStatus = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'Completado';
    case 'processing':
      return 'Procesando';
    case 'error':
      return 'Error';
    case 'pending':
      return 'Pendiente';
    default:
      return status;
  }
};

// Función para obtener la clase CSS del badge según el estado
const getStatusBadgeClass = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'processing':
      return 'bg-blue-100 text-blue-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  return (
    <span
      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(
        status,
      )} ${className}`}>
      {translateStatus(status)}
    </span>
  );
};

export default DocumentStatusBadge;
