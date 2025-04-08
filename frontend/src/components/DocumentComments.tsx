import { useState, useEffect } from 'react';
import { api } from '../api/client';
import useAuth from '../hooks/UseAuth';
import Button from './Button';

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
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [permission, setPermission] = useState<string | null>(null);
  const [newCommentsAvailable, setNewCommentsAvailable] = useState(false);

  // Para simular nuevos comentarios (en producción usarías websockets o polling)
const checkForNewComments = () => {
  const interval = setInterval(async () => {
    if (documentId) {
      try {
        const response = await api.get(`/api/comments/document/${documentId}/unread-count`);
        if (response.data > 0) {
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
    const cleanup = checkForNewComments();
    return cleanup;
  }, [documentId]);

  useEffect(() => {
    // Actualizar el contador de comentarios cuando cambian
    if (onCommentsUpdated) {
      onCommentsUpdated(comments.filter(c => !c.isResolved).length);
    }
  }, [comments]);

  const checkPermission = async () => {
    try {
      const response = await api.get(`/api/sharing/document/${documentId}/check-permission?action=comment`);
      if (response.data.canAccess) {
        setPermission('comment');
      } else {
        const viewResponse = await api.get(`/api/sharing/document/${documentId}/check-permission?action=view`);
        if (viewResponse.data.canAccess) {
          setPermission('view');
        }
      }
    } catch (err) {
      console.error('Error checking permissions:', err);
      setPermission(null);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/comments/document/${documentId}?includeReplies=true`);
      setComments(response.data);
      
      // Marcar comentarios como leídos
      try {
        await api.post(`/api/comments/document/${documentId}/mark-read`);
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

  const addComment = async () => {
    if (!newComment.trim()) return;
    
    setAddingComment(true);
    try {
      const commentData = {
        documentId,
        content: newComment,
        position: {
          ...(currentPage && { page: currentPage }),
          ...(position && { x: position.x, y: position.y }),
          ...(selectedText && { selection: {
            start: selectedText.start,
            end: selectedText.end,
            text: selectedText.text,
          }}),
        },
      };
      
      await api.post('/api/comments', commentData);
      setNewComment('');
      fetchComments();
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (err: any) {
      console.error('Error adding comment:', err);
      setError(err?.response?.data?.message || 'Error al añadir comentario');
    } finally {
      setAddingComment(false);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canComment = permission === 'comment';

  const renderComment = (comment: Comment, isReply = false) => {
    const isCurrentUser = user?.id === comment.userId;
    
    return (
      <div key={comment.id} className={`mb-4 ${isReply ? 'ml-8' : ''} ${comment.isResolved ? 'opacity-60' : ''}`}>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
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
                </div>
                <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                  {comment.content}
                </div>
                
                {comment.position?.selection && (
                  <div className="p-2 mt-2 text-xs italic text-gray-600 border-l-2 border-gray-300 bg-gray-50">
                    {comment.position.selection.text}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {comment.isResolved && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Resuelto
                </span>
              )}
              
              {!isReply && canComment && (
                <button
                  onClick={() => {
                    if (replyTo === comment.id) {
                      setReplyTo(null);
                    } else {
                      setReplyTo(comment.id);
                      setReplyContent('');
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Responder
                </button>
              )}
              
              {canComment && (
                <>
                  {!comment.isResolved && (
                    <button
                      onClick={() => resolveComment(comment.id, true)}
                      className="text-xs text-green-600 hover:text-green-800"
                    >
                      Resolver
                    </button>
                  )}
                  
                  {comment.isResolved && (
                    <button
                      onClick={() => resolveComment(comment.id, false)}
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      Reabrir
                    </button>
                  )}
                </>
              )}
              
              {isCurrentUser && (
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
          
          {/* Reply Input */}
          {replyTo === comment.id && canComment && (
            <div className="pt-3 mt-3 border-t border-gray-100">
              <div className="flex">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Escribe una respuesta..."
                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  rows={2}
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
                  onClick={() => addReply(comment.id)}
                  disabled={!replyContent.trim()}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Responder
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  // Filtrar comentarios principales (no respuestas)
  const mainComments = comments.filter(comment => !comment.parentId);
  
  // Filtrar según estado de resolución
  const filteredComments = showResolved 
    ? mainComments 
    : mainComments.filter(comment => !comment.isResolved);

  return (
    <div className="p-4 rounded-lg bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Comentarios
          {!loading && (
            <span className="ml-2 text-sm text-gray-500">
              ({mainComments.filter(c => !c.isResolved).length})
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
      
      {/* New comment input */}
      {canComment && (
        <div className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Añadir un comentario..."
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            rows={3}
          ></textarea>
          <div className="flex justify-end mt-2">
            <Button
              onClick={addComment}
              disabled={addingComment || !newComment.trim()}
              size="small"
            >
              {addingComment ? 'Añadiendo...' : 'Comentar'}
            </Button>
          </div>
          
          {selectedText && (
            <div className="p-2 mt-2 text-xs italic text-gray-600 bg-gray-100 border-l-2 border-blue-300">
              Comentando sobre: "{selectedText.text}"
            </div>
          )}
        </div>
      )}
      
      {/* Comments list */}
      {loading ? (
        <div className="py-10 text-center">
          <svg className="w-8 h-8 mx-auto text-blue-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : (
        <div>
          {filteredComments.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              {mainComments.length === 0 ? (
                <p>No hay comentarios en este documento.</p>
              ) : (
                <p>No hay comentarios sin resolver.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComments.map(comment => renderComment(comment))}
            </div>
          )}
        </div>
      )}
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