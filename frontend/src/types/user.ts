// src/types/user.ts

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  twoFactorEnabled?: boolean;
  biometricAuthEnabled?: boolean;
  createdAt: string;
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  isAdmin: boolean;
}

export interface UserSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export interface DeleteConfirmationModalProps {
  user: User | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  formData: UserFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isEdit?: boolean;
  isLoading?: boolean;
  error?: string;
}
