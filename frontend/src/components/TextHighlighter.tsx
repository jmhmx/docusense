import { useState, useEffect, useRef } from 'react';

interface TextHighlighterProps {
  children: React.ReactNode;
  onHighlight?: (selection: { text: string; range: Range; rects: DOMRect[] }) => void;
  onSelectionChange?: (selection: { text: string; start: number; end: number }) => void;
  highlightColor?: string;
  enabled?: boolean;
}

type HighlightData = {
  id: string;
  text: string;
  rects: { top: number; left: number; width: number; height: number }[];
  color: string;
};

const TextHighlighter: React.FC<TextHighlighterProps> = ({
  children,
  onHighlight,
  onSelectionChange,
  highlightColor = '#FFEB3B',
  enabled = true,
}) => {
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<{ text: string; range: Range; rects: DOMRect[] } | null>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (!enabled) return;
      
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        setSelectedText(null);
        setContextMenuPos(null);
        return;
      }
      
      const range = selection.getRangeAt(0);
      const text = selection.toString().trim();
      
      if (text) {
        const rects = Array.from(range.getClientRects());
        setSelectedText({ text, range, rects });
        
        // Si hay un callback para cambios de selección, llamarlo
        if (onSelectionChange) {
          onSelectionChange({
            text,
            start: range.startOffset,
            end: range.endOffset,
          });
        }
        
        // Mostrar menú contextual cerca de la selección
        const lastRect = rects[rects.length - 1];
        if (lastRect) {
          setContextMenuPos({
            x: lastRect.right,
            y: lastRect.bottom + 5,
          });
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [enabled, onSelectionChange]);

  const handleCreateHighlight = (color = highlightColor) => {
    if (!selectedText) return;
    
    const { text, rects } = selectedText;
    
    const newHighlight: HighlightData = {
      id: `highlight-${Date.now()}`,
      text,
      rects: rects.map(rect => {
        const containerRect = containerRef.current?.getBoundingClientRect();
        return {
          top: rect.top - (containerRect?.top || 0),
          left: rect.left - (containerRect?.left || 0),
          width: rect.width,
          height: rect.height,
        };
      }),
      color,
    };
    
    setHighlights(prev => [...prev, newHighlight]);
    
    // Llamar al callback si existe
    if (onHighlight) {
      onHighlight(selectedText);
    }
    
    // Limpiar selección
    window.getSelection()?.removeAllRanges();
    setSelectedText(null);
    setContextMenuPos(null);
  };

  return (
    <div ref={containerRef} className="relative">
      {children}
      
      {/* Renderizar highlights existentes */}
      {highlights.map(highlight => (
        <div key={highlight.id}>
          {highlight.rects.map((rect, i) => (
            <div
              key={`${highlight.id}-${i}`}
              className="absolute pointer-events-none"
              style={{
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                backgroundColor: highlight.color,
                opacity: 0.3,
                zIndex: 10,
              }}
            />
          ))}
        </div>
      ))}
      
      {/* Menú contextual para crear resaltado */}
      {contextMenuPos && selectedText && (
        <div
          className="absolute z-50 p-1 bg-white rounded-md shadow-lg"
          style={{
            top: `${contextMenuPos.y}px`,
            left: `${contextMenuPos.x}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex space-x-1">
            <button
              onClick={() => handleCreateHighlight('#FFEB3B')}
              className="w-6 h-6 bg-yellow-200 rounded-full hover:ring-2 hover:ring-yellow-500"
              title="Resaltar en amarillo"
            />
            <button
              onClick={() => handleCreateHighlight('#4CAF50')}
              className="w-6 h-6 bg-green-200 rounded-full hover:ring-2 hover:ring-green-500"
              title="Resaltar en verde"
            />
            <button
              onClick={() => handleCreateHighlight('#F44336')}
              className="w-6 h-6 bg-red-200 rounded-full hover:ring-2 hover:ring-red-500"
              title="Resaltar en rojo"
            />
            <button
              onClick={() => handleCreateHighlight('#2196F3')}
              className="w-6 h-6 bg-blue-200 rounded-full hover:ring-2 hover:ring-blue-500"
              title="Resaltar en azul"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TextHighlighter;