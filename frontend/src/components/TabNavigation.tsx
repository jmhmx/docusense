import { ReactNode, useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabNavigationProps {
  tabs: Tab[];
  defaultTabId?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const TabNavigation = ({
  tabs,
  defaultTabId,
  orientation = 'horizontal',
  className = '',
}: TabNavigationProps) => {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id || '');

  // Si no hay pestañas, no renderizar nada
  if (tabs.length === 0) {
    return null;
  }

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];

  const isVertical = orientation === 'vertical';

  return (
    <div className={`${className} ${isVertical ? 'flex flex-row' : ''}`}>
      {/* Barra de navegación de pestañas */}
      <div className={`
        ${isVertical 
          ? 'flex flex-col border-r border-gray-200 pr-1 min-w-[200px]' 
          : 'flex border-b border-gray-200 mb-4'}
      `}>
        <nav className={`${isVertical ? '-mb-px space-y-1 w-full' : '-mb-px flex space-x-4 overflow-x-auto'}`}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`
                ${isVertical 
                  ? 'flex items-center py-3 px-4 w-full text-left'
                  : 'flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap'}
                ${activeTabId === tab.id
                  ? isVertical
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'border-blue-500 text-blue-600'
                  : isVertical
                    ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
              aria-current={activeTabId === tab.id ? 'page' : undefined}
            >
              {tab.icon && (
                <span className={`${isVertical ? 'mr-3' : 'mr-2'} ${activeTabId === tab.id ? 'text-blue-500' : 'text-gray-400'}`}>
                  {tab.icon}
                </span>
              )}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido de la pestaña activa */}
      <div className={`${isVertical ? 'flex-1 pl-4' : 'w-full'}`}>
        {activeTab.content}
      </div>
    </div>
  );
};

export default TabNavigation;