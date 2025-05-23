import { useState } from 'react';
import SearchInput from './SearchInput';

interface FiltersPanelProps {
  filters: {
    status: string;
    dateRange: string;
    searchQuery: string;
  };
  onFilterChange: any;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
  onSortDirectionChange: () => void;
}

const FiltersPanel = ({
  filters,
  onFilterChange,
  sortField,
  sortDirection,
  onSort,
  onSortDirectionChange,
}: FiltersPanelProps) => {
  // Estado local para manejar el valor del campo de búsqueda
  const [localSearchQuery, setLocalSearchQuery] = useState(filters.searchQuery);

  // Manejar cambio en el campo de búsqueda
  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    onFilterChange('searchQuery', value);
  };

  return (
    <div className='p-4 mb-6 transition-shadow duration-300 bg-white rounded-lg shadow hover:shadow-sm'>
      <div className='grid items-center grid-cols-1 gap-4 md:grid-cols-5'>
        <div>
          <label className='block text-sm font-medium text-gray-700'>
            Estado
          </label>
          <select
            className='block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500'
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}>
            <option value='all'>Todos</option>
            <option value='pending'>Pendiente</option>
            <option value='processing'>Procesando</option>
            <option value='completed'>Completado</option>
            <option value='error'>Error</option>
          </select>
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700'>
            Fecha
          </label>
          <select
            className='block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500'
            value={filters.dateRange}
            onChange={(e) => onFilterChange('dateRange', e.target.value)}>
            <option value='all'>Todos</option>
            <option value='today'>Hoy</option>
            <option value='week'>Última semana</option>
            <option value='month'>Último mes</option>
          </select>
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700'>
            Ordenar por
          </label>
          <div className='flex mt-1'>
            <select
              className='block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500'
              value={sortField}
              onChange={(e) => onSort(e.target.value)}>
              <option value='createdAt'>Fecha</option>
              <option value='title'>Título</option>
              <option value='fileSize'>Tamaño</option>
            </select>
          </div>
        </div>
        <div>
          <label className='block mb-1 text-sm font-medium text-gray-700'>
            Dirección
          </label>
          <button
            className='p-2 transition-colors duration-200 bg-gray-200 rounded-md hover:bg-gray-300'
            onClick={onSortDirectionChange}
            aria-label={
              sortDirection === 'asc'
                ? 'Ordenar descendente'
                : 'Ordenar ascendente'
            }>
            {sortDirection === 'asc' ? (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-5 h-5'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z'
                  clipRule='evenodd'
                />
              </svg>
            ) : (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='w-5 h-5'
                viewBox='0 0 20 20'
                fill='currentColor'>
                <path
                  fillRule='evenodd'
                  d='M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z'
                  clipRule='evenodd'
                />
              </svg>
            )}
          </button>
        </div>
        <div>
          <label className='block text-sm font-medium text-gray-700'>
            Buscar
          </label>
          <SearchInput
            value={localSearchQuery}
            onChange={handleSearchChange}
            placeholder='Buscar documentos...'
            className='mt-1'
            autoFocus={false}
            debounceTime={300}
          />
        </div>
      </div>
    </div>
  );
};

export default FiltersPanel;
