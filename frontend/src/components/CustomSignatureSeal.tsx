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
  };
  content: {
    showName: boolean;
    showDate: boolean;
    showReason: boolean;
    showLogo: boolean;
    customText?: string;
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
    },
    content: {
      showName: true,
      showDate: true,
      showReason: !!reason,
      showLogo: false,
      customText: '',
    },
  });
  
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Actualizar vista previa cuando cambian las opciones
  useEffect(() => {
    renderPreview();
  }, [sealData, uploadedLogo]);
  
  // Renderizar vista previa
  const renderPreview = () => {
    if (!previewRef.current) return;
    
    const preview = previewRef.current;
    
    // Aplicar estilos
    preview.style.borderColor = sealData.style.borderColor;
    preview.style.borderStyle = sealData.style.borderStyle;
    preview.style.backgroundColor = sealData.style.backgroundColor;
    preview.style.color = sealData.style.color;
    
    // Aplicar forma
    switch (sealData.style.shape) {
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
  };
  
  // Cambiar un valor de estilo
  const handleStyleChange = (property: keyof SealData['style'], value: string) => {
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
        handleContentChange('showLogo', true);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Eliminar logo
  const handleRemoveLogo = () => {
    setUploadedLogo(null);
    handleContentChange('showLogo', false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Guardar sello
  const handleSave = () => {
    // Agregar logo si existe
    const finalSealData = {
      ...sealData,
      image: uploadedLogo || undefined,
    };
    
    onSave(finalSealData);
  };
  
  return (
    <div className="max-w-4xl p-6 bg-white rounded-lg shadow-xl">
      <h2 className="mb-6 text-xl font-semibold text-gray-800">Personalizar sello de firma</h2>
      
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">
        {/* Panel de opciones */}
        <div className="space-y-4">
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
          
          <h3 className="mt-4 text-lg font-medium text-gray-700">Contenido</h3>
          
          {/* Opciones de contenido */}
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showName"
                checked={sealData.content.showName}
                onChange={(e) => handleContentChange('showName', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="showName" className="ml-2 text-sm">Mostrar nombre</label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showDate"
                checked={sealData.content.showDate}
                onChange={(e) => handleContentChange('showDate', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="showDate" className="ml-2 text-sm">Mostrar fecha</label>
            </div>
            
            {reason && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showReason"
                  checked={sealData.content.showReason}
                  onChange={(e) => handleContentChange('showReason', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="showReason" className="ml-2 text-sm">Mostrar motivo</label>
              </div>
            )}
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showLogo"
                checked={sealData.content.showLogo}
                onChange={(e) => {
                  if (!e.target.checked) {
                    handleRemoveLogo();
                  } else if (!uploadedLogo) {
                    // Activar diálogo de archivo
                    fileInputRef.current?.click();
                  } else {
                    handleContentChange('showLogo', true);
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="showLogo" className="ml-2 text-sm">Mostrar logo</label>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
              
              {uploadedLogo && (
                <button
                  onClick={handleRemoveLogo}
                  className="ml-2 text-xs text-red-600 hover:text-red-800"
                >
                  Eliminar
                </button>
              )}
            </div>
            
            <div>
              <label htmlFor="customText" className="block mb-1 text-sm font-medium">Texto personalizado</label>
              <textarea
                id="customText"
                value={sealData.content.customText || ''}
                onChange={(e) => handleContentChange('customText', e.target.value)}
                className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                rows={2}
                placeholder="Texto adicional para el sello..."
              />
            </div>
          </div>
        </div>
        
        {/* Vista previa */}
        <div>
          <h3 className="mb-4 text-lg font-medium text-gray-700">Vista previa</h3>
          <div 
            ref={previewRef}
            className="flex flex-col h-40 p-4 border-2 w-72"
            style={{
              borderColor: sealData.style.borderColor,
              borderStyle: sealData.style.borderStyle,
              backgroundColor: sealData.style.backgroundColor,
              color: sealData.style.color,
              borderRadius: sealData.style.shape === 'round' ? '12px' : sealData.style.shape === 'circle' ? '50%' : '0',
              aspectRatio: sealData.style.shape === 'circle' ? '1/1' : 'auto',
            }}
          >
            <div className="flex items-center justify-between">
              {uploadedLogo && sealData.content.showLogo && (
                <img 
                  src={uploadedLogo} 
                  alt="Logo" 
                  className="object-contain w-12 h-12"
                />
              )}
              
              <div className="flex-1 ml-2">
                {sealData.content.showName && (
                  <div className="font-medium">{name}</div>
                )}
                
                {sealData.content.showDate && (
                  <div className="text-sm">{date}</div>
                )}
                
                {sealData.content.showReason && reason && (
                  <div className="text-sm">Motivo: {reason}</div>
                )}
                
                {sealData.content.customText && (
                  <div className="mt-1 text-sm">{sealData.content.customText}</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            Esta es una vista previa aproximada. El aspecto final puede variar ligeramente.
          </div>
        </div>
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button
          variant="secondary"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
        >
          Guardar sello
        </Button>
      </div>
    </div>
  );
};

export default CustomSignatureSeal;