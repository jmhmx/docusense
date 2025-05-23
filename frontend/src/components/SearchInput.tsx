import { useState, useEffect, useRef } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  debounceTime?: number;
}

/**
 * Componente de entrada de búsqueda mejorado con debounce y manejo apropiado del foco
 */
const SearchInput = ({
  value,
  onChange,
  placeholder = 'Buscar...',
  className = '',
  autoFocus = false,
  debounceTime = 300,
}: SearchInputProps) => {
  // Estado interno para el valor del input
  const [inputValue, setInputValue] = useState(value);
  // Referencia al elemento input para manejar el foco
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar el estado interno con el valor de prop cuando cambia externamente
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Efecto para manejar el debounce en las actualizaciones
  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, debounceTime);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, onChange, value, debounceTime]);

  // Efecto para aplicar autoFocus si se solicita
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Actualiza solo el estado interno, el efecto se encargará de propagar el cambio
    setInputValue(e.target.value);
  };

  return (
    <div className='relative w-full'>
      <input
        ref={inputRef}
        type='text'
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      />
      {inputValue && (
        <button
          type='button'
          className='absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600'
          onClick={() => {
            setInputValue('');
            onChange('');
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }}
          aria-label='Limpiar búsqueda'>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            className='w-5 h-5'
            viewBox='0 0 20 20'
            fill='currentColor'>
            <path
              fillRule='evenodd'
              d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
              clipRule='evenodd'
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchInput;
