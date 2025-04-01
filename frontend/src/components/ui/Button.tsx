import React from 'react';
import './animations.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  isLoading,
  className = '',
  ...props 
}) => {
  return (
    <button
      className={`bg-primary hover:bg-primary-hover text-white py-3 px-6 rounded-lg 
        shadow-sm hover:shadow-md disabled:opacity-70 
        ${isLoading ? 'button-loading' : ''} 
        ${className}`}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? 'Processing...' : children}
    </button>
  );
};