import { useState, useEffect } from 'react';
import { api } from '../api/client';
import useAuth from '../hooks/UseAuth';
import RichCommentEditor from './RichCommentEditor';

interface User {
  id: string;
  name: string;
  email: string;
}

interface CommentPosition {
  page?: number;
  x?: number;
  y?: number;
  selection?: {
    start: number;
    end: number;
    text: string;
  };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  parentId?: string;
  user?: User;
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  position?: CommentPosition;
  replies?: Comment[];
}

interface DocumentCommentsProps {
  documentId: string;
  currentPage?: number;
  selectedText?: {
    text: string;
    start: number;
    end: number;
  };
  position?: {
    x: number;
    y: number;
  };
  onCommentAdded?: () => void;
  onCommentsUpdated?: (count: number) => void;
}

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  onReply: (commentId: string) => void;
  onResolve: (commentId: string, isResolved: boolean) => void;
  onDelete: (commentId: string) => void;
  canComment: boolean;
  currentUser: User | null;
  availableUsers: User[];
}

// Componente para renderizar un comentario individual
const CommentItem = ({ 
  comment, 
  isReply = false, 
  onReply, 
  onResolve, 
  onDelete, 
  canComment, 
  currentUser, 
  availableUsers 
}: CommentItemProps) => {
  const [showReplies, setShowReplies] = useState(true);
  const isCurrentUser = currentUser?.id === comment.userId;
  const hasReplies = comment.replies ? comment.replies.length > 0 : false;
  
  // Función para formatear el contenido con menciones resaltadas
  const formatContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            const userName = part.substring(1);
            const user = availableUsers.find(u => u.name === userName);
            
            return (
              <span 
                key={index} 
                className="font-medium text-blue-600"
                title={user ? `${user.name} (${user.email})` : ''} 
              >
                {part}
              </span>
            );
          }
          
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  return (
    <div className={`mb-4 ${isReply ? 'ml-8' : ''} transition-all duration-200`}>
      <div className={`p-4 bg-white border rounded-lg ${comment.isResolved 
        ? 'border-green-200 bg-green-50 bg-opacity-20' 
        : 'border-gray-200'}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <div className="mr-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                <span className="text-sm font-medium text-blue-800">
                  {comment.user?.name?.substring(0, 2).toUpperCase() || '??'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center">
                <span className="text-sm font-medium text-gray-900">
                  {comment.user?.name || 'Usuario desconocido'}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {formatDate(comment.createdAt)}
                </span>
                
                {comment.isResolved && (
                  <span className="inline-flex items-center px-2 py-0.5 ml-2 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Resuelto
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                {formatContent(comment.content)}
              </div>
              
              {comment.position?.selection && (
                <div className="p-2 mt-2 text-xs italic text-gray-600 border-l-2 border-gray-300 bg-gray-50">
                  {comment.position.selection.text}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isReply && canComment && (
              <button
                onClick={() => onReply(comment.id)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 rounded-md bg-blue-50 hover:bg-blue-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Responder
              </button>
            )}
            
            {canComment && (
              <>
                {!comment.isResolved && (
                  <button
                    onClick={() => onResolve(comment.id, true)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-600 rounded-md bg-green-50 hover:bg-green-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Resolver
                  </button>
                )}
                
                {comment.isResolved && (
                  <button
                    onClick={() => onResolve(comment.id, false)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reabrir
                  </button>
                )}
              </>
            )}
            
            {isCurrentUser && (
              <button
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 rounded-md bg-red-50 hover:bg-red-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Replies */}
      {hasReplies && (
        <div className="mt-2">
          <div className="flex items-center mb-1">
            <button 
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center text-xs text-gray-500 hover:text-gray-700"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`w-4 h-4 mr-1 transition-transform ${showReplies ? 'transform rotate-90' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {comment.replies?.length || 0} respuesta{(comment.replies?.length || 0) !== 1 ? 's' : ''}
            </button>
          </div>
          
          {showReplies && comment.replies && (
            <div className="pl-4 border-l-2 border-gray-200">
              {comment.replies.map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isReply={true}
                  onReply={onReply}
                  onResolve={onResolve}
                  onDelete={onDelete}
                  canComment={canComment}
                  currentUser={currentUser}
                  availableUsers={availableUsers}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DocumentComments = ({
  documentId,
  currentPage = 1,
  selectedText,
  position,
  onCommentAdded,
  onCommentsUpdated,
}: DocumentCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  //@ts-ignore
  const [userPermission, setUserPermission] = useState<string | null>(null);
  const [newCommentsAvailable, setNewCommentsAvailable] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [canComment, setCanComment] = useState(false);
  //@ts-ignore
  const [unreadCommentsCount, setUnreadCommentsCount] = useState(0);

  // Para verificar nuevos comentarios periódicamente (con websockets o polling)
  const checkForNewComments = () => {
    const interval = setInterval(async () => {
      if (documentId) {
        try {
          const response = await fetchUnreadCount();
          if (response > 0) {
            setNewCommentsAvailable(true);
          }
        } catch (err) {
          console.error('Error al verificar nuevos comentarios:', err);
        }
      }
    }, 30000); // Verificar cada 30 segundos

    return () => clearInterval(interval);
  };

  useEffect(() => {
    fetchComments();
    checkPermission();
    fetchUnreadCount();
    const cleanup = checkForNewComments();
    return cleanup;
  }, [documentId]);

  useEffect(() => {
    // Actualizar el contador de comentarios cuando cambian
    if (onCommentsUpdated) {
      onCommentsUpdated(comments.filter(c => !c.isResolved).length);
    }
  }, [comments, onCommentsUpdated]);

  useEffect(() => {
    // Cargar usuarios disponibles para menciones
    const fetchAvailableUsers = async () => {
      try {
        // Usamos la API específica que verifica permisos en el documento
        const response = await api.get(`/api/comments/document/${documentId}/available-users`);
        setAvailableUsers(response.data);
      } catch (err) {
        console.error('Error cargando usuarios disponibles:', err);
        // Fallback a la API general de usuarios si la específica falla
        try {
          const generalResponse = await api.get('/api/users/available');
          setAvailableUsers(generalResponse.data);
        } catch (fallbackErr) {
          console.error('Error en fallback de usuarios:', fallbackErr);
        }
      }
    };
  
    if (canComment) {
      fetchAvailableUsers();
    }
  }, [canComment, documentId]);

  const checkPermission = async () => {
    try {
      const response = await api.get(`/api/sharing/document/${documentId}/check-permission?action=comment`);
      if (response.data.canAccess) {
        setUserPermission('comment');
        setCanComment(true);
      } else {
        const viewResponse = await api.get(`/api/sharing/document/${documentId}/check-permission?action=view`);
        if (viewResponse.data.canAccess) {
          setUserPermission('view');
          setCanComment(false);
        } else {
          setCanComment(false);
        }
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      setUserPermission(null);
      setCanComment(false);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/comments/document/${documentId}?includeReplies=true`);
      setComments(response.data);
      
      // Marcar comentarios como leídos
      try {
        await markCommentsAsRead();
        setNewCommentsAvailable(false);
      } catch (err) {
        console.error('Error marking comments as read:', err);
      }
    } catch (err: any) {
      console.error('Error fetching comments:', err);
      setError(err?.response?.data?.message || 'Error al cargar comentarios');
    } finally {
      setLoading(false);
    }
  };

  // Función para marcar comentarios como leídos
  const markCommentsAsRead = async () => {
    try {
      await api.post(`/api/comments/document/${documentId}/mark-read`);
      console.log('Comentarios marcados como leídos correctamente');
      setUnreadCommentsCount(0);
    } catch (err) {
      console.error('Error marking comments as read:', err);
      throw err;
    }
  };

  // Función para obtener conteo de no leídos
  const fetchUnreadCount = async () => {
    try {
      const response = await api.get(`/api/comments/document/${documentId}/unread-count`);
      setUnreadCommentsCount(response.data);
      return response.data;
    } catch (err) {
      console.error('Error al obtener comentarios no leídos:', err);
      return 0;
    }
  };

  const addComment = async (commentData: any) => {
    if (!commentData.content.trim()) return;
    
    try {
      await api.post('/api/comments', commentData);
      
      // Si hay menciones, se habrán procesado automáticamente en el backend
      fetchComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (err: any) {
      console.error('Error al añadir comentario:', err);
      setError(err?.response?.data?.message || 'Error al añadir comentario');
    }
  };

  const addReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    
    try {
      const replyData = {
        documentId,
        content: replyContent,
        parentId,
      };
      
      await api.post('/api/comments', replyData);
      setReplyTo(null);
      setReplyContent('');
      fetchComments();
    } catch (err: any) {
      console.error('Error adding reply:', err);
      setError(err?.response?.data?.message || 'Error al añadir respuesta');
    }
  };

  const resolveComment = async (commentId: string, isResolved: boolean) => {
    try {
      await api.patch(`/api/comments/${commentId}`, {
        isResolved,
      });
      fetchComments();
    } catch (err: any) {
      console.error('Error resolving comment:', err);
      setError(err?.response?.data?.message || 'Error al resolver comentario');
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!window.confirm('¿Está seguro de eliminar este comentario?')) {
      return;
    }
    
    try {
      await api.delete(`/api/comments/${commentId}`);
      fetchComments();
    } catch (err: any) {
      console.error('Error deleting comment:', err);
      setError(err?.response?.data?.message || 'Error al eliminar comentario');
    }
  };

  const handleReply = (commentId: string) => {
    if (replyTo === commentId) {
      setReplyTo(null);
    } else {
      setReplyTo(commentId);
      setReplyContent('');
    }
  };

  // Función para renderizar comentarios
  const renderComments = () => {
    if (loading) {
      return (
        <div className="py-10 text-center">
          <svg className="w-8 h-8 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    }
    
    // Filtrar comentarios para la visualización
    const mainComments = comments.filter(comment => !comment.parentId);
    const filteredComments = showResolved 
      ? mainComments 
      : mainComments.filter(comment => !comment.isResolved);
      
    if (filteredComments.length === 0) {
      return (
        <div className="py-8 text-center text-gray-500">
          {mainComments.length === 0 ? (
            <p>No hay comentarios en este documento.</p>
          ) : (
            <p>No hay comentarios sin resolver.</p>
          )}
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {filteredComments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={handleReply}
            onResolve={resolveComment}
            onDelete={deleteComment}
            canComment={canComment}
            currentUser={user}
            availableUsers={availableUsers}
          />
        ))}
      </div>
    );
  };

  // Renderizar componente de respuesta
  const renderReplyForm = () => {
    if (!replyTo) return null;
    
    const parentComment = comments.find(c => c.id === replyTo);
    if (!parentComment) return null;
    
    return (
      <div className="p-4 mb-4 rounded-lg bg-blue-50">
        <div className="mb-2 text-sm font-medium text-blue-700">
          Respondiendo a {parentComment.user?.name || 'Usuario'}:
        </div>
        <div className="p-2 mb-3 text-sm bg-white border border-blue-100 rounded">
          {parentComment.content}
        </div>
        <div className="flex">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Escribe una respuesta..."
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            rows={3}
          ></textarea>
        </div>
        <div className="flex justify-end mt-2 space-x-2">
          <button
            onClick={() => setReplyTo(null)}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            onClick={() => addReply(replyTo)}
            disabled={!replyContent.trim()}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Responder
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Comentarios
          {!loading && (
            <span className="ml-2 text-sm text-gray-500">
              ({comments.filter(c => !c.isResolved && !c.parentId).length})
            </span>
          )}
        </h3>
        <div className="flex items-center">
          <label className="inline-flex items-center mr-4">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600">
              Mostrar resueltos
            </span>
          </label>
          <button
            onClick={fetchComments}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Refrescar comentarios"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      
      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 rounded-md bg-red-50">
          {error}
        </div>
      )}
      
      {/* Formulario de respuesta */}
      {renderReplyForm()}
      
      {/* Nuevo comentario input */}
      {canComment && !replyTo && (
        <div className="mb-6">
          <RichCommentEditor
            onSubmit={(content, mentions) => {
              // Preparar datos del comentario
              const commentData = {
                documentId,
                content,
                position: {
                  ...(currentPage && { page: currentPage }),
                  ...(position && { x: position.x, y: position.y }),
                  ...(selectedText && { selection: {
                    start: selectedText.start,
                    end: selectedText.end,
                    text: selectedText.text,
                  }}),
                },
                mentions // Campo para menciones
              };
              
              // Enviar comentario
              addComment(commentData);
            }}
            availableUsers={availableUsers}
            placeholder="Añadir un comentario... Usa @ para mencionar usuarios"
          />
          
          {selectedText && (
            <div className="p-2 mt-2 text-xs italic text-gray-600 bg-gray-100 border-l-2 border-blue-300">
              Comentando sobre: "{selectedText.text}"
            </div>
          )}
        </div>
      )}
      
      {/* Lista de comentarios */}
      {renderComments()}
      
      {/* Notificación de nuevos comentarios */}
      {newCommentsAvailable && (
        <div className="fixed z-50 p-4 text-white bg-blue-500 rounded-md shadow-lg bottom-4 right-4 animate-bounce">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
            <span>Nuevos comentarios disponibles</span>
            <button 
              onClick={fetchComments}
              className="p-1 ml-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              Refrescar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentComments;