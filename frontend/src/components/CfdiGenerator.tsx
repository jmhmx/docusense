// frontend/src/components/CfdiGenerador.tsx
import { useState } from 'react';
import { api } from '../api/client';
import Button from './Button';
//import Input from './Input';

interface FormaPagoOption {
  clave: string;
  descripcion: string;
}

interface MetodoPagoOption {
  clave: string;
  descripcion: string;
}

interface UsoCfdiOption {
  clave: string;
  descripcion: string;
}

const formasPago: FormaPagoOption[] = [
  { clave: '01', descripcion: 'Efectivo' },
  { clave: '02', descripcion: 'Cheque nominativo' },
  { clave: '03', descripcion: 'Transferencia electrónica de fondos' },
  { clave: '04', descripcion: 'Tarjeta de crédito' },
  { clave: '28', descripcion: 'Tarjeta de débito' },
];

const metodosPago: MetodoPagoOption[] = [
  { clave: 'PUE', descripcion: 'Pago en una sola exhibición' },
  { clave: 'PPD', descripcion: 'Pago en parcialidades o diferido' },
];

const usosCfdi: UsoCfdiOption[] = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G03', descripcion: 'Gastos en general' },
  { clave: 'P01', descripcion: 'Por definir' },
];

const CfdiGenerador = () => {
  const [formData, setFormData] = useState({
    tipoCFDI: 'I',
    serie: 'A',
    folio: '1',
    formaPago: '01',
    metodoPago: 'PUE',
    moneda: 'MXN',
    subtotal: 0,
    total: 0,
    emisor: {
      rfc: 'TEST010101ABC',
      nombre: 'EMPRESA DE PRUEBA SA DE CV',
      regimenFiscal: '601'
    },
    receptor: {
      rfc: 'XAXX010101000',
      nombre: 'PÚBLICO EN GENERAL',
      usoCFDI: 'G03',
      domicilioFiscalReceptor: '12345',
      regimenFiscalReceptor: '616'
    },
    conceptos: [
      {
        claveProdServ: '01010101',
        cantidad: 1,
        claveUnidad: 'H87',
        unidad: 'PIEZA',
        descripcion: 'Producto de prueba',
        valorUnitario: 100,
        importe: 100,
        impuestos: [
          {
            impuesto: '002',
            tipoFactor: 'Tasa',
            tasaOCuota: '0.160000',
            importe: 16
          }
        ]
      }
    ]
  });

  const [xmlResult, setXmlResult] = useState('');
  const [timbradoResult, setTimbradoResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'datos' | 'xml' | 'timbrado'>('datos');

  // Actualizar conceptos
  const handleConceptoChange = (index: number, field: string, value: any) => {
    const conceptos = [...formData.conceptos];
    conceptos[index] = {
      ...conceptos[index],
      [field]: value
    };

    // Recalcular importes
    if (field === 'cantidad' || field === 'valorUnitario') {
      const cantidad = field === 'cantidad' ? value : conceptos[index].cantidad;
      const valorUnitario = field === 'valorUnitario' ? value : conceptos[index].valorUnitario;
      const importe = cantidad * valorUnitario;
      
      conceptos[index].importe = importe;
      
      // Actualizar impuestos
      if (conceptos[index].impuestos && conceptos[index].impuestos.length > 0) {
        const impuestos = [...conceptos[index].impuestos];
        for (let i = 0; i < impuestos.length; i++) {
          if (impuestos[i].tipoFactor === 'Tasa') {
            const tasaOCuota = parseFloat(impuestos[i].tasaOCuota);
            impuestos[i].importe = importe * tasaOCuota;
          }
        }
        conceptos[index].impuestos = impuestos;
      }
    }

    // Recalcular subtotal y total
    let subtotal = 0;
    let impuestos = 0;
    
    for (const concepto of conceptos) {
      subtotal += concepto.importe;
      
      if (concepto.impuestos) {
        for (const impuesto of concepto.impuestos) {
          impuestos += impuesto.importe;
        }
      }
    }
    
    setFormData({
      ...formData,
      conceptos,
      subtotal,
      total: subtotal + impuestos
    });
  };

  // Generar CFDI
  const handleGenerarCFDI = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Preparar datos para enviar
      const cfdiData = {
        ...formData,
        fecha: new Date().toISOString().split('.')[0]
      };
      
      const response = await api.post('/api/sat/cfdi/generar', cfdiData);
      
      if (response.data.success) {
        setXmlResult(response.data.xml);
        setStep('xml');
      } else {
        setError(response.data.error || 'Error al generar CFDI');
      }
    } catch (err: any) {
      console.error('Error al generar CFDI:', err);
      setError(err?.response?.data?.message || 'Error al generar CFDI');
    } finally {
      setIsLoading(false);
    }
  };

  // Timbrar CFDI
  const handleTimbrarCFDI = async () => {
    if (!xmlResult) {
      setError('No hay XML para timbrar');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.post('/api/sat/cfdi/timbrar', { xml: xmlResult });
      
      setTimbradoResult(response.data);
      setStep('timbrado');
    } catch (err: any) {
      console.error('Error al timbrar CFDI:', err);
      setError(err?.response?.data?.message || 'Error al timbrar CFDI');
    } finally {
      setIsLoading(false);
    }
  };

  // Descargar XML
  const handleDescargarXML = () => {
    if (!xmlResult) return;
    
    const blob = new Blob([xmlResult], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cfdi_${formData.serie}${formData.folio}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h3 className="mb-4 text-lg font-medium text-gray-900">Generador de CFDI</h3>
      
      {error && (
        <div className="p-4 mb-4 border-l-4 border-red-400 bg-red-50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {step === 'datos' && (
        <div>
          <div className="grid grid-cols-1 gap-4 p-4 border rounded-md sm:grid-cols-2">
            <h4 className="col-span-2 font-medium">Información General</h4>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Tipo de Comprobante</label>
              <select 
                value={formData.tipoCFDI}
                onChange={(e) => setFormData({...formData, tipoCFDI: e.target.value})}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="I">Ingreso</option>
                <option value="E">Egreso</option>
                <option value="T">Traslado</option>
                <option value="P">Pago</option>
                <option value="N">Nómina</option>
              </select>
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Serie y Folio</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.serie}
                  onChange={(e) => setFormData({...formData, serie: e.target.value})}
                  className="block w-1/4 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Serie"
                />
                <input
                  type="text"
                  value={formData.folio}
                  onChange={(e) => setFormData({...formData, folio: e.target.value})}
                  className="block w-3/4 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Folio"
                />
              </div>
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Forma de Pago</label>
              <select 
                value={formData.formaPago}
                onChange={(e) => setFormData({...formData, formaPago: e.target.value})}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {formasPago.map(forma => (
                  <option key={forma.clave} value={forma.clave}>{forma.clave} - {forma.descripcion}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Método de Pago</label>
              <select 
                value={formData.metodoPago}
                onChange={(e) => setFormData({...formData, metodoPago: e.target.value})}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {metodosPago.map(metodo => (
                  <option key={metodo.clave} value={metodo.clave}>{metodo.clave} - {metodo.descripcion}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Moneda</label>
              <select 
                value={formData.moneda}
                onChange={(e) => setFormData({...formData, moneda: e.target.value})}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="MXN">MXN - Peso Mexicano</option>
                <option value="USD">USD - Dólar Americano</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 p-4 mt-4 border rounded-md sm:grid-cols-2">
            <h4 className="col-span-2 font-medium">Emisor</h4>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">RFC</label>
              <input
                type="text"
                value={formData.emisor.rfc}
                onChange={(e) => setFormData({
                  ...formData, 
                  emisor: {...formData.emisor, rfc: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Nombre</label>
              <input
                type="text"
                value={formData.emisor.nombre}
                onChange={(e) => setFormData({
                  ...formData, 
                  emisor: {...formData.emisor, nombre: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Régimen Fiscal</label>
              <select 
                value={formData.emisor.regimenFiscal}
                onChange={(e) => setFormData({
                  ...formData, 
                  emisor: {...formData.emisor, regimenFiscal: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="601">General de Ley Personas Morales</option>
                <option value="612">Personas Físicas con Actividades Empresariales y Profesionales</option>
                <option value="621">Incorporación Fiscal</option>
                <option value="626">Régimen Simplificado de Confianza</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 p-4 mt-4 border rounded-md sm:grid-cols-2">
            <h4 className="col-span-2 font-medium">Receptor</h4>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">RFC</label>
              <input
                type="text"
                value={formData.receptor.rfc}
                onChange={(e) => setFormData({
                  ...formData, 
                  receptor: {...formData.receptor, rfc: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Nombre</label>
              <input
                type="text"
                value={formData.receptor.nombre}
                onChange={(e) => setFormData({
                  ...formData, 
                  receptor: {...formData.receptor, nombre: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Uso CFDI</label>
              <select 
                value={formData.receptor.usoCFDI}
                onChange={(e) => setFormData({
                  ...formData, 
                  receptor: {...formData.receptor, usoCFDI: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                {usosCfdi.map(uso => (
                  <option key={uso.clave} value={uso.clave}>{uso.clave} - {uso.descripcion}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Domicilio Fiscal</label>
              <input
                type="text"
                value={formData.receptor.domicilioFiscalReceptor}
                onChange={(e) => setFormData({
                  ...formData, 
                  receptor: {...formData.receptor, domicilioFiscalReceptor: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Código Postal"
              />
            </div>
            
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Régimen Fiscal</label>
              <select 
                value={formData.receptor.regimenFiscalReceptor}
                onChange={(e) => setFormData({
                  ...formData, 
                  receptor: {...formData.receptor, regimenFiscalReceptor: e.target.value}
                })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="616">Sin obligaciones fiscales</option>
                <option value="601">General de Ley Personas Morales</option>
                <option value="612">Personas Físicas con Actividades Empresariales y Profesionales</option>
                <option value="626">Régimen Simplificado de Confianza</option>
              </select>
            </div>
          </div>
          
          <div className="p-4 mt-4 border rounded-md">
            <h4 className="mb-2 font-medium">Conceptos</h4>
            
            {formData.conceptos.map((concepto, index) => (
              <div key={index} className="p-2 mb-4 border rounded-md">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Clave Prod/Serv</label>
                    <input
                      type="text"
                      value={concepto.claveProdServ}
                      onChange={(e) => handleConceptoChange(index, 'claveProdServ', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Descripción</label>
                    <input
                      type="text"
                      value={concepto.descripcion}
                      onChange={(e) => handleConceptoChange(index, 'descripcion', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Cantidad</label>
                    <input
                      type="number"
                      value={concepto.cantidad}
                      onChange={(e) => handleConceptoChange(index, 'cantidad', parseFloat(e.target.value))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Valor Unitario</label>
                    <input
                      type="number"
                      value={concepto.valorUnitario}
                      onChange={(e) => handleConceptoChange(index, 'valorUnitario', parseFloat(e.target.value))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Importe</label>
                    <input
                      type="number"
                      value={concepto.importe}
                      readOnly
                      className="block w-full px-3 py-2 text-gray-500 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">Impuesto Trasladado</label>
                    <input
                      type="number"
                      value={concepto.impuestos?.[0]?.importe || 0}
                      readOnly
                      className="block w-full px-3 py-2 text-gray-500 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="grid grid-cols-2 gap-4 p-4 mt-4 rounded-md bg-gray-50">
              <div className="text-right">
                <span className="font-medium">Subtotal:</span>
              </div>
              <div>
                <span>{formData.subtotal.toFixed(2)}</span>
              </div>
              
              <div className="text-right">
                <span className="font-medium">Impuestos:</span>
              </div>
              <div>
                <span>{(formData.total - formData.subtotal).toFixed(2)}</span>
              </div>
              
              <div className="text-right">
                <span className="font-medium">Total:</span>
              </div>
              <div>
                <span>{formData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <Button
              onClick={handleGenerarCFDI}
              disabled={isLoading}
            >
              {isLoading ? 'Generando...' : 'Generar CFDI'}
            </Button>
          </div>
        </div>
      )}
      
      {step === 'xml' && (
        <div>
          <div className="p-4 mb-4 rounded-md bg-green-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  // frontend/src/components/CfdiGenerador.tsx (continuación)
                 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
               </svg>
             </div>
             <div className="ml-3">
               <h3 className="text-sm font-medium text-green-800">CFDI generado correctamente</h3>
               <div className="mt-2 text-sm text-green-700">
                 <p>El XML ha sido generado. Ahora puede timbrar el CFDI o descargar el XML.</p>
               </div>
             </div>
           </div>
         </div>
         
         <div className="p-4 border rounded-md">
           <h4 className="mb-2 font-medium">XML Generado</h4>
           <div className="h-64 p-4 overflow-auto font-mono text-sm rounded-md bg-gray-50">
             <pre>{xmlResult}</pre>
           </div>
         </div>
         
         <div className="flex justify-between mt-6">
           <Button
             onClick={() => setStep('datos')}
             variant="secondary"
           >
             Volver a Datos
           </Button>
           
           <div className="flex space-x-2">
             <Button
               onClick={handleDescargarXML}
               variant="secondary"
             >
               Descargar XML
             </Button>
             
             <Button
               onClick={handleTimbrarCFDI}
               disabled={isLoading}
             >
               {isLoading ? 'Timbrando...' : 'Timbrar CFDI'}
             </Button>
           </div>
         </div>
       </div>
     )}
     
     {step === 'timbrado' && (
       <div>
         <div className={`p-4 mb-4 rounded-md ${timbradoResult?.success ? 'bg-green-50' : 'bg-red-50'}`}>
           <div className="flex">
             <div className="flex-shrink-0">
               {timbradoResult?.success ? (
                 <svg className="w-5 h-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                 </svg>
               ) : (
                 <svg className="w-5 h-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                 </svg>
               )}
             </div>
             <div className="ml-3">
               <h3 className={`text-sm font-medium ${timbradoResult?.success ? 'text-green-800' : 'text-red-800'}`}>
                 {timbradoResult?.success ? 'CFDI timbrado correctamente' : 'Error al timbrar CFDI'}
               </h3>
               <div className={`mt-2 text-sm ${timbradoResult?.success ? 'text-green-700' : 'text-red-700'}`}>
                 <p>
                   {timbradoResult?.success 
                     ? `El CFDI ha sido timbrado con UUID: ${timbradoResult?.uuid}` 
                     : `Error: ${timbradoResult?.error || 'Error desconocido'}`}
                 </p>
               </div>
             </div>
           </div>
         </div>
         
         {timbradoResult?.success && timbradoResult?.timbradoXml && (
           <div className="p-4 border rounded-md">
             <h4 className="mb-2 font-medium">XML Timbrado</h4>
             <div className="h-64 p-4 overflow-auto font-mono text-sm rounded-md bg-gray-50">
               <pre>{timbradoResult.timbradoXml}</pre>
             </div>
           </div>
         )}
         
         <div className="flex justify-between mt-6">
           <Button
             onClick={() => setStep('xml')}
             variant="secondary"
           >
             Volver a XML
           </Button>
           
           {timbradoResult?.success && (
             <Button
               onClick={() => {
                 // Descargar XML timbrado
                 const blob = new Blob([timbradoResult.timbradoXml], { type: 'application/xml' });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `cfdi_timbrado_${timbradoResult.uuid}.xml`;
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 URL.revokeObjectURL(url);
               }}
             >
               Descargar CFDI Timbrado
             </Button>
           )}
         </div>
       </div>
     )}
   </div>
 );
};

export default CfdiGenerador;