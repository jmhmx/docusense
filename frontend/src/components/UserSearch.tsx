import { UserSearchProps } from '../types/user';

const UserSearch = ({ searchQuery, setSearchQuery }: UserSearchProps) => {
  return (
    <div className='mb-6'>
      <input
        type='text'
        placeholder='Buscar usuarios...'
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className='w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500'
      />
    </div>
  );
};

export default UserSearch;
