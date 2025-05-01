import React from 'react';

interface DocumentMetricsCardProps {
  title: string;
  value: number;
  change: number;
  icon: React.ReactNode;
}

const DocumentMetricsCard = ({ title, value, change, icon }: DocumentMetricsCardProps) => {
  return (
    <div className="overflow-hidden bg-white rounded-lg shadow">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">{icon}</div>
          <div className="flex-1 w-0 ml-5">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">{value}</div>
              </dd>
            </dl>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 bg-gray-50">
        <div className="text-sm">
          <span
            className={`font-medium ${
              change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {change >= 0 ? '+' : ''}
            {change}%
          </span>{' '}
          <span className="text-gray-500">desde el período anterior</span>
        </div>
      </div>
    </div>
  );
};

export default DocumentMetricsCard;