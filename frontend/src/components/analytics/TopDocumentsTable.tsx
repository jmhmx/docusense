import { useNavigate } from 'react-router-dom';

interface Document {
  id: string;
  title: string;
  views: number;
  lastViewed: string;
}

interface TopDocumentsTableProps {
  documents: Document[];
}

const TopDocumentsTable = ({ documents }: TopDocumentsTableProps) => {
  const navigate = useNavigate();

  if (!documents || documents.length === 0) {
    return (
      <div className="py-6 text-center text-gray-500">
        No hay documentos para mostrar.
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleViewDocument = (id: string) => {
    navigate(`/documents/${id}`);
  };

  return (
    <div className="overflow-hidden rounded-md">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">
              Documento
            </th>
            <th scope="col" className="px-3 py-3 text-xs font-medium tracking-wider text-center text-gray-500 uppercase">
              Vistas
            </th>
            <th scope="col" className="px-3 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">
              Última vista
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {documents.map((doc) => (
            <tr 
              key={doc.id} 
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => handleViewDocument(doc.id)}
            >
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="max-w-xs text-sm font-medium text-gray-900 truncate">
                  {doc.title}
                </div>
              </td>
              <td className="px-3 py-2 text-center whitespace-nowrap">
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {doc.views}
                </div>
              </td>
              <td className="px-3 py-2 text-sm text-right text-gray-500 whitespace-nowrap">
                {formatDate(doc.lastViewed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TopDocumentsTable;