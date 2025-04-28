import { useState, useRef, useEffect } from 'react';
import Button from './Button';

interface CustomSignatureSealProps {
  name: string;
  date: string;
  reason?: string;
  onSave: (sealData: SealData) => void;
  onCancel: () => void;
}

interface SealData {
  text: string;
  image?: string;
  style: {
    color: string;
    borderColor: string;
    borderStyle: string;
    shape: 'rectangle' | 'round' | 'circle';
    backgroundColor: string;
    fontSize: string;
    fontFamily: string;
    borderWidth: string;
    rotation: number;
    shadow: boolean;
    shadowColor: string;
  };
  content: {
    showName: boolean;
    showDate: boolean;
    showReason: boolean;
    showLogo: boolean;
    showSignature: boolean;
    signatureData?: string;
    customText?: string;
    customTitle?: string;
    position: 'left' | 'center' | 'right';
    layoutDirection: 'horizontal' | 'vertical';
  };
  metadata: {
    device: string;
    createdAt: string;
    version: string;
  };
}

const CustomSignatureSeal = ({ name, date, reason, onSave, onCancel }: CustomSignatureSealProps) => {
  const [sealData, setSealData] = useState<SealData>({
    text: '',
    style: {
      color: '#000000',
      borderColor: '#0040A0',
      borderStyle: 'solid',
      shape: 'rectangle',
      backgroundColor: 'rgba(240, 247, 255, 0.8)',
      fontSize: 'medium',
      fontFamily: 'Arial',
      borderWidth: '2px',
      rotation: 0,
      shadow: false,
      shadowColor: 'rgba(0, 0, 0, 0.3)',
    },
    content: {
      showName: true,
      showDate: true,
      showReason: !!reason,
      showLogo: false,
      showSignature: false,
      customText: '',
      customTitle: 'DOCUMENTO FIRMADO ELECTRÓNICAMENTE',
      position: 'left',
      layoutDirection: 'vertical',
    },
    metadata: {
      device: navigator.userAgent,
      createdAt: new Date().toISOString(),
      version: '2.0',
    },
  });
  
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [signatureDrawn, setSignatureDrawn] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'style' | 'content' | 'preview'>('style');
  const [showRotationControl, setShowRotationControl] = useState(false);
  const [selectedFontSize, setSelectedFontSize] = useState('medium');
  const [selectedPosition, setSelectedPosition] = useState('left');
  
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  
  // Templates predefinidos
  const templates = [
    {
      name: 'Corporativo',
      style: {
        color: '#1a365d',
        borderColor: '#2b6cb0',
        borderStyle: 'solid',
        shape: 'rectangle',
        backgroundColor: 'rgba(235, 244, 255, 0.9)',
        fontSize: 'medium',
        fontFamily: 'Arial',
        borderWidth: '2px',
        rotation: 0,
        shadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.2)',
      },
      content: {
        showName: true,
        showDate: true,
        showReason: true,
        showLogo: true,
        showSignature: false,
        customTitle: 'DOCUMENTO OFICIAL',
        position: 'left',
        layoutDirection: 'vertical',
      }
    },
    {
      name: 'Notarial',
      style: {
        color: '#1a3e1a',
        borderColor: '#2f572f',
        borderStyle: 'double',
        shape: 'rectangle',
        backgroundColor: 'rgba(240, 249, 240, 0.9)',
        fontSize: 'medium',
        fontFamily: 'Times New Roman',
        borderWidth: '3px',
        rotation: 0,
        shadow: false,
        shadowColor: 'rgba(0, 0, 0, 0.3)',
      },
      content: {
        showName: true,
        showDate: true,
        showReason: true,
        showLogo: false,
        showSignature: true,
        customTitle: 'CERTIFICACIÓN NOTARIAL',
        position: 'center',
        layoutDirection: 'vertical',
      }
    },
    {
      name: 'Minimalista',
      style: {
        color: '#4a5568',
        borderColor: '#cbd5e0',
        borderStyle: 'solid',
        shape: 'round',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        fontSize: 'small',
        fontFamily: 'Helvetica',
        borderWidth: '1px',
        rotation: 0,
        shadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.1)',
      },
      content: {
        showName: true,
        showDate: true,
        showReason: false,
        showLogo: false,
        showSignature: false,
        customTitle: '',
        position: 'right',
        layoutDirection: 'horizontal',
      }
    },
  ];
  
  // Actualizar vista previa cuando cambian las opciones
  useEffect(() => {
    renderPreview();
  }, [sealData, uploadedLogo, signatureDrawn]);
  
  // Inicializar canvas de firma
  useEffect(() => {
    if (!signatureCanvasRef.current) return;
    
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    
    // Handlers para dibujar
    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawingRef.current = true;
      const { offsetX, offsetY } = getEventCoordinates(e, canvas);
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY);
    };
    
    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingRef.current) return;
      const { offsetX, offsetY } = getEventCoordinates(e, canvas);
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
    };
    
    const stopDrawing = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        // Guardar la firma como data URL
        setSignatureDrawn(canvas.toDataURL());
        
        // Activar firma en el sello
        setSealData(prev => ({
          ...prev,
          content: {
            ...prev.content,
            showSignature: true,
            signatureData: canvas.toDataURL(),
          }
        }));
      }
    };
    
    // Funciones auxiliares para manejar eventos táctiles
    function getEventCoordinates(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
      let offsetX, offsetY;
      
      if (e instanceof MouseEvent) {
        const rect = canvas.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      } else {
        // Es un evento táctil
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        offsetX = touch.clientX - rect.left;
        offsetY = touch.clientY - rect.top;
      }
      
      return { offsetX, offsetY };
    }
    
    // Agregar event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Eventos táctiles
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Limpiar event listeners
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, []);
  
  // Renderizar vista previa
  const renderPreview = () => {
    if (!previewRef.current) return;
    
    const preview = previewRef.current;
    const style = sealData.style;
    
    // Aplicar estilos
    preview.style.borderColor = style.borderColor;
    preview.style.borderStyle = style.borderStyle;
    preview.style.borderWidth = style.borderWidth;
    preview.style.backgroundColor = style.backgroundColor;
    preview.style.color = style.color;
    preview.style.fontFamily = style.fontFamily;
    
    // Aplicar forma
    switch (style.shape) {
      case 'round':
        preview.style.borderRadius = '12px';
        break;
      case 'circle':
        preview.style.borderRadius = '50%';
        preview.style.aspectRatio = '1/1';
        break;
      default:
        preview.style.borderRadius = '0';
    }
    
    // Aplicar sombra si está activada
    if (style.shadow) {
      preview.style.boxShadow = `0 4px 6px ${style.shadowColor}`;
    } else {
      preview.style.boxShadow = 'none';
    }
    
    // Aplicar rotación
    preview.style.transform = `rotate(${style.rotation}deg)`;
    
    // Aplicar tamaño de fuente
    switch (style.fontSize) {
      case 'small':
        preview.style.fontSize = '0.875rem';
        break;
      case 'medium':
        preview.style.fontSize = '1rem';
        break;
      case 'large':
        preview.style.fontSize = '1.25rem';
        break;
      default:
        preview.style.fontSize = '1rem';
    }
    
    // Aplicar alineación
    switch (sealData.content.position) {
      case 'left':
        preview.style.textAlign = 'left';
        break;
      case 'center':
        preview.style.textAlign = 'center';
        break;
      case 'right':
        preview.style.textAlign = 'right';
        break;
    }
  };
  
  // Cambiar un valor de estilo
  const handleStyleChange = (property: keyof SealData['style'], value: string | number | boolean) => {
    setSealData({
      ...sealData,
      style: {
        ...sealData.style,
        [property]: value,
      },
    });
  };
  
  // Cambiar un valor de contenido
  const handleContentChange = (property: keyof SealData['content'], value: boolean | string) => {
    setSealData({
      ...sealData,
      content: {
        ...sealData.content,
        [property]: value,
      },
    });
  };
  
  // Manejar subida de logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tamaño y tipo
    if (file.size > 500000) { // 500KB máximo
      alert('El logo es demasiado grande. Máximo 500KB permitido.');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen.');
      return;
    }
    
    // Convertir a base64
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedLogo(event.target.result.toString());
        setSealData(prev => ({
          ...prev,
          content: {
            ...prev.content,
            showLogo: true,
          },
          image: event.target.result.toString(),
        }));
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Eliminar logo
  const handleRemoveLogo = () => {
    setUploadedLogo(null);
    setSealData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        showLogo: false,
      },
      image: undefined,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Limpiar canvas de firma
  const clearSignature = () => {
    if (!signatureCanvasRef.current) return;
    
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDrawn(null);
    
    setSealData(prev => ({
      ...prev,
      content: {
        ...prev.content,
        showSignature: false,
        signatureData: undefined,
      }
    }));
  };
  
  // Aplicar template
  const applyTemplate = (index: number) => {
    const template = templates[index];
    
    setSealData(prev => ({
      ...prev,
      style: {
        ...prev.style,
        ...template.style,
      },
      content: {
        ...prev.content,
        ...template.content,
      }
    }));
    
    setSelectedFontSize(template.style.fontSize);
    setSelectedPosition(template.content.position);
  };
  
  // Guardar sello
  const handleSave = () => {
    // Versión final del sello
    const finalSealData: SealData = {
      ...sealData,
      image: uploadedLogo || undefined,
    };
    
    onSave(finalSealData);
  };
  
  return (
    <div className="max-w-4xl p-6 mx-auto bg-white rounded-lg shadow-xl">
      <h2 className="mb-4 text-xl font-semibold text-gray-800">
        Personalizar sello de firma
      </h2>
      
      {/* Pestañas */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('style')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'style'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Estilo
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'content'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Contenido
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Vista previa
          </button>
        </nav>
      </div>
      
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
        {/* Panel de opciones */}
        <div className="space-y-6">
          {/* Templates predefinidos */}
          <div className="pb-4 mb-6 border-b border-gray-200">
            <h3 className="mb-3 text-base font-medium text-gray-700">Plantillas rápidas</h3>
            <div className="grid grid-cols-3 gap-3">
              {templates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => applyTemplate(index)}
                  className="p-2 text-xs text-center border rounded hover:bg-gray-50"
                >
                  <div 
                    className="w-full h-12 mx-auto mb-1 border-2 rounded"
                    style={{
                      borderColor: template.style.borderColor,
                      borderStyle: template.style.borderStyle,
                      backgroundColor: template.style.backgroundColor,
                    }}
                  ></div>
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        
          {activeTab === 'style' && (
            <>
              <h3 className="text-lg font-medium text-gray-700">Opciones de estilo</h3>
              
              {/* Color de texto */}
              <div>
                <label className="block mb-1 text-sm font-medium">Color de texto</label>
                <div className="flex items-center">
                  <input
                    type="color"
                    value={sealData.style.color}
                    onChange={(e) => handleStyleChange('color', e.target.value)}
                    className="w-10 h-8 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">{sealData.style.color}</span>
                </div>
              </div>
              
              {/* Color de fondo */}
              <div>
                <label className="block mb-1 text-sm font-medium">Color de fondo</label>
                <div className="flex items-center">
                  <input
                    type="color"
                    value={sealData.style.backgroundColor.replace('rgba(', '').replace(')', '').split(',').slice(0, 3).join(',')}
                    onChange={(e) => {
                      // Convertir hexadecimal a rgba con opacidad 0.8
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1, 3), 16);
                      const g = parseInt(hex.slice(3, 5), 16);
                      const b = parseInt(hex.slice(5, 7), 16);
                      handleStyleChange('backgroundColor', `rgba(${r}, ${g}, ${b}, 0.8)`);
                    }}
                    className="w-10 h-8 rounded"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={parseInt(sealData.style.backgroundColor.replace('rgba(', '').replace(')', '').split(',')[3].trim()) * 100}
                    onChange={(e) => {
                      // Actualizar opacidad manteniendo el color
                      const rgba = sealData.style.backgroundColor.replace('rgba(', '').replace(')', '').split(',');
                      const opacity = parseInt(e.target.value) / 100;
                      handleStyleChange('backgroundColor', `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${opacity})`);
                    }}
                    className="w-24 h-8 mx-2"
                  />
                  <span className="text-sm text-gray-600">Opacidad: {Math.round(parseFloat(sealData.style.backgroundColor.replace('rgba(', '').replace(')', '').split(',')[3].trim()) * 100)}%</span>
                </div>
              </div>
              
              {/* Color de borde */}
              <div>
                <label className="block mb-1 text-sm font-medium">Color de borde</label>
                <div className="flex items-center">
                  <input
                    type="color"
                    value={sealData.style.borderColor}
                    onChange={(e) => handleStyleChange('borderColor', e.target.value)}
                    className="w-10 h-8 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">{sealData.style.borderColor}</span>
                </div>
              </div>
              
              {/* Estilo de borde */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium">Estilo de borde</label>
                  <select
                    value={sealData.style.borderStyle}
                    onChange={(e) => handleStyleChange('borderStyle', e.target.value)}
                    className="block w-full py-2 pl-3 pr-10 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="solid">Sólido</option>
                    <option value="dashed">Discontinuo</option>
                    <option value="dotted">Punteado</option>
                    <option value="double">Doble</option>
                  </select>
                </div>
                
                <div>
                  <label className="block mb-1 text-sm font-medium">Grosor de borde</label>
                  <select
                    value={sealData.style.borderWidth}
                    onChange={(e) => handleStyleChange('borderWidth', e.target.value)}
                    className="block w-full py-2 pl-3 pr-10 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1px">Fino</option>
                    <option value="2px">Medio</option>
                    <option value="3px">Grueso</option>
                    <option value="4px">Muy grueso</option>
                  </select>
                </div>
              </div>
              
              {/* Forma */}
              <div>
                <label className="block mb-1 text-sm font-medium">Forma</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => handleStyleChange('shape', 'rectangle')}
                    className={`p-2 border rounded ${sealData.style.shape === 'rectangle' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
                  >
                    <div className="w-8 h-6 bg-gray-300 rounded-sm"></div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStyleChange('shape', 'round')}
                    className={`p-2 border rounded ${sealData.style.shape === 'round' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
                  >
                    <div className="w-8 h-6 bg-gray-300 rounded-md"></div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStyleChange('shape', 'circle')}
                    className={`p-2 border rounded ${sealData.style.shape === 'circle' ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
                  >
                    <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
                  </button>
                </div>
              </div>
              
              {/* Fuente */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-sm font-medium">Tipo de fuente</label>
                  <select
                    value={sealData.style.fontFamily}
                    onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                    className="block w-full py-2 pl-3 pr-10 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                  </select>
                </div>
                
                <div>
                  <label className="block mb-1 text-sm font-medium">Tamaño de fuente</label>
                  <select
                    value={selectedFontSize}
                    onChange={(e) => {
                      setSelectedFontSize(e.target.value);
                      handleStyleChange('fontSize', e.target.value);
                    }}
                    className="block w-full py-2 pl-3 pr-10 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="small">Pequeño</option>
                    <option value="medium">Mediano</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
              </div>
              
              {/* Rotación */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block mb-1 text-sm font-medium">Rotación</label>
                  <button
                    type="button"
                    onClick={() => setShowRotationControl(!showRotationControl)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {showRotationControl ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                
                {showRotationControl && (
                  <div className="mt-2">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={sealData.style.rotation}
                      onChange={(e) => handleStyleChange('rotation', parseInt(e.target.value))}
                      className="w-full h-6"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>-180°</span>
                      <span>{sealData.style.rotation}°</span>
                      <span>180°</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Sombra */}
              <div>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="enableShadow"
                    checked={sealData.style.shadow}
                    onChange={(e) => handleStyleChange('shadow', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="enableShadow" className="ml-2 text-sm font-medium">
                    Activar sombra
                  </label>
                </div>
                
                {sealData.style.shadow && (
                  <div className="ml-6">
                    <label className="block mb-1 text-sm">Color de sombra</label>
                    <div className="flex items-center">
                      <input
                        type="color"
                        value="#000000"
                        onChange={(e) => {
                          // Convertir hexadecimal a rgba con opacidad 0.3
                          const hex = e.target.value;
                          const r = parseInt(hex.slice(1, 3), 16);
                          const g = parseInt(hex.slice(3, 5), 16);
                          const b = parseInt(hex.slice(5, 7), 16);
                          handleStyleChange('shadowColor', `rgba(${r}, ${g}, ${b}, 0.3)`);
                        }}
                        className="w-8 h-8 rounded"
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={30}
                        onChange={(e) => {
                          // Actualizar opacidad manteniendo el color
                          const rgba = sealData.style.shadowColor.replace('rgba(', '').replace(')', '').split(',');
                          const opacity = parseInt(e.target.value) / 100;
                          handleStyleChange('shadowColor', `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${opacity})`);
                        }}
                        className="w-24 h-8 mx-2"
                      />
                      <span className="text-sm text-gray-600">Opacidad</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          
          {activeTab === 'content' && (
            <>
              <h3 className="text-lg font-medium text-gray-700">Opciones de contenido</h3>
              
              {/* Título personalizado */}
              <div>
                <label htmlFor="customTitle" className="block mb-1 text-sm font-medium">Título del sello</label>
                <input
                  id="customTitle"
                  type="text"
                  value={sealData.content.customTitle || ''}
                  onChange={(e) => handleContentChange('customTitle', e.target.value)}
                  placeholder="Título opcional del sello"
                  className="block w-