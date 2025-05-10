import { useState, useEffect, useRef } from 'react';
import Button from './Button';

interface User {
  id: string;
  name: string;
  email?: string;
}

interface RichCommentEditorProps {
  onSubmit: (content: string, mentions: string[]) => void;
  onCancel?: () => void;
  initialValue?: string;
  availableUsers?: User[];
  placeholder?: string;
}

const RichCommentEditor = ({
  onSubmit,
  onCancel,
  initialValue = '',
  availableUsers = [],
  placeholder = 'Escribe un comentario...'
}: RichCommentEditorProps) => {
  const [content, setContent] = useState(initialValue);
  const [showToolbar, setShowToolbar] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
  const [mentions, setMentions] = useState<string[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  
  const editorRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (mentionQuery.length > 0) {
      const filtered = availableUsers.filter(user => 
        user.name.toLowerCase().includes(mentionQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [mentionQuery, availableUsers]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '@') {
      // Iniciar mención
      setShowMentions(true);
      setMentionQuery('');
      const start = e.currentTarget.selectionStart || 0;
      setMentionPosition({ start, end: start });
    } else if (showMentions && e.key === 'Escape') {
      // Cancelar mención
      setShowMentions(false);
    } else if (showMentions && e.key === 'Enter' && filteredUsers.length > 0) {
      // Seleccionar primera opción de mención
      e.preventDefault();
      insertMention(filteredUsers[0]);
    } else if (showMentions && e.key === 'ArrowDown') {
      // Navegar por opciones
      e.preventDefault();
      // Aquí se implementaría la navegación por las opciones
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setContent(newValue);
    
    // Si hay una mención activa, actualizar la consulta
    if (showMentions) {
      const currentPos = e.target.selectionStart || 0;
      const mentionText = newValue.substring(mentionPosition.start, currentPos);
      setMentionQuery(mentionText.replace('@', ''));
      setMentionPosition({ ...mentionPosition, end: currentPos });
    }
  };
  
  const insertMention = (user: User) => {
    if (!editorRef.current) return;
    
    const beforeMention = content.substring(0, mentionPosition.start);
    const afterMention = content.substring(mentionPosition.end);
    const mentionText = `@${user.name} `;
    
    // Actualizar el contenido con la mención
    const newContent = beforeMention + mentionText + afterMention;
    setContent(newContent);
    
    // Agregar el ID del usuario a las menciones
    setMentions([...mentions, user.id]);
    
    // Cerrar el panel de menciones
    setShowMentions(false);
    
    // Enfocar y posicionar el cursor después de la mención
    const newCursorPosition = mentionPosition.start + mentionText.length;
    editorRef.current.focus();
    editorRef.current.selectionStart = newCursorPosition;
    editorRef.current.selectionEnd = newCursorPosition;
  };
  
  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content, mentions);
      setContent('');
      setMentions([]);
    }
  };
  
  // Aplicar formato simple (negrita, cursiva, etc.)
  const applyFormat = (format: string) => {
    if (!editorRef.current) return;
    
    const start = editorRef.current.selectionStart;
    const end = editorRef.current.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `_${selectedText}_`;
        break;
      case 'code':
        formattedText = `\`${selectedText}\``;
        break;
      default:
        formattedText = selectedText;
    }
    
    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);
    
    // Reposicionar cursor
    editorRef.current.focus();
    const newPosition = start + formattedText.length;
    editorRef.current.selectionStart = newPosition;
    editorRef.current.selectionEnd = newPosition;
  };

  return (
    <div className="w-full">
      <div className="relative">
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowToolbar(true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder={placeholder}
          rows={3}
        />
        
        {/* Sugerencias de menciones */}
        {showMentions && filteredUsers.length > 0 && (
          <div className="absolute z-10 w-64 mt-1 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg max-h-60">
            <ul className="py-1">
              {filteredUsers.map(user => (
                <li 
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className="px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-blue-100"
                >
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-6 h-6 mr-2 bg-blue-100 rounded-full">
                      <span className="text-xs font-medium text-blue-800">
                        {user.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span>{user.name}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Barra de herramientas */}
      {showToolbar && (
        <div className="flex items-center mt-2 space-x-2">
          <button
            type="button"
            onClick={() => applyFormat('bold')}
            className="p-1 text-gray-600 hover:text-gray-900"
            title="Negrita"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.5 10c0 1.5-1.5 2-3 2H7V8h3.5c1.5 0 3 .5 3 2zM7 16h4.5c1.5 0 3-.5 3-2 0-1.5-1.5-2-3-2H7v4z" />
              <path fillRule="evenodd" d="M7 4h7a4 4 0 014 4v8a4 4 0 01-4 4H7a4 4 0 01-4-4V8a4 4 0 014-4zm0 2a2 2 0 00-2 2v8a2 2 0 002 2h7a2 2 0 002-2V8a2 2 0 00-2-2H7z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => applyFormat('italic')}
            className="p-1 text-gray-600 hover:text-gray-900"
            title="Cursiva"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6 5H4v2h2V5zm10 8V5h-2v8h2zM8 5H6v2h2V5zm2 8h8v-2h-8v2zm0-4h8V7h-8v2zm-2 4V5h-2v8h2zm-4 0h2v-2H4v2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => applyFormat('code')}
            className="p-1 text-gray-600 hover:text-gray-900"
            title="Código"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (editorRef.current) {
                const cursorPos = editorRef.current.selectionStart || 0;
                const textBefore = content.substring(0, cursorPos);
                const textAfter = content.substring(cursorPos);
                setContent(textBefore + '@' + textAfter);
                // Simular que se presionó @
                setShowMentions(true);
                setMentionQuery('');
                setMentionPosition({ start: cursorPos, end: cursorPos + 1 });
                // Reposicionar cursor
                setTimeout(() => {
                  if (editorRef.current) {
                    editorRef.current.focus();
                    editorRef.current.selectionStart = cursorPos + 1;
                    editorRef.current.selectionEnd = cursorPos + 1;
                  }
                }, 0);
              }
            }}
            className="p-1 text-gray-600 hover:text-gray-900"
            title="Mencionar usuario"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex-grow"></div>
          <div className="space-x-2">
            {onCancel && (
              <Button 
                variant="secondary" 
                size="small" 
                onClick={onCancel}
              >
                Cancelar
              </Button>
            )}
            <Button 
              variant="primary" 
              size="small" 
              onClick={handleSubmit}
              disabled={!content.trim()}
            >
              Comentar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichCommentEditor;