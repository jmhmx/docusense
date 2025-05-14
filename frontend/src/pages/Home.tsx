import { Link } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';
import { motion } from 'framer-motion';

const Home = () => {
  const { isAuthenticated } = useAuth();

  const featureVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-gray-50 to-gray-100">
      {/* SEO Meta Tags */}
      <title>DocuSense - Firma Electrónica y Gestión Documental en México</title>
      <meta name="description" content="Plataforma líder en firma electrónica en México con cumplimiento legal (SAT, LFEA), biometría, blockchain y precios accesibles para PYMES y profesionales." />
      <meta name="keywords" content="firma electrónica méxico, e.firma SAT, LFEA, biometría, blockchain, gestión documental, PYMES méxico, contadores, abogados" />
      <meta name="author" content="Engine Core" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://www.docusense.mx/" /> {/* Replace with your actual domain */}

      {/* Hero Section - Full Width */}
      <section className="relative px-4 pt-20 pb-16 overflow-hidden text-center sm:px-6 lg:px-8 bg-blue-50"> {/* Added bg-blue-50 for better contrast */}
        <div className="absolute inset-0 z-0">
          {/* SVG Animation as Background */}
          <img src="/hero2.jpg" alt="Document management and electronic signature animation" className="object-cover w-full h-full opacity-75"/> {/* Adjusted opacity */}
        </div>
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 mx-auto max-w-7xl" // Content centered within max-width
        >
          <h1 className="mb-6 text-5xl font-extrabold text-gray-900 md:text-6xl drop-shadow-sm"> {/* Added drop-shadow */}
          Firma Electrónica <span className="text-blue-700">Segura y Legal</span> en México
          </h1>
          <p className="max-w-3xl mx-auto mb-10 text-xl text-gray-700 md:text-2xl drop-shadow-sm"> {/* Adjusted text color and added drop-shadow */}
            Cumple con el Código de Comercio y la LFEA. Integra e.firma SAT, biometría y blockchain para máxima validez y seguridad.
          </p>
          <div className="flex flex-col justify-center gap-4 mb-16 sm:flex-row">
            {isAuthenticated ? (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link to="/dashboard" className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Ir al Dashboard
                </Link>
              </motion.div>
            ) : (
              <>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link to="/register" className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Comenzar Gratis
                  </Link>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Link to="/login" className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    Iniciar Sesión
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        </motion.div>
      </section>

      {/* Key Differentiators Section (Based on idea.md) */}
      <section className="px-4 py-16 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <h2 className="mb-12 text-3xl font-bold text-center text-gray-900">
          ¿Por qué DocuSense? Nuestros Diferenciadores Clave
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          <motion.div
            variants={featureVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-8 transition-shadow duration-300 bg-white rounded-lg shadow-md hover:shadow-lg"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-4 bg-blue-100 rounded-lg">
               <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
            </div>
            <h3 className="mb-3 text-xl font-semibold text-gray-900">Especialización en México</h3>
            <p className="text-gray-600">
              Cumplimos con Código de Comercio, LFEA e integramos e.firma SAT para trámites fiscales y legales.
            </p>
          </motion.div>

          <motion.div
            variants={featureVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-8 transition-shadow duration-300 bg-white rounded-lg shadow-md hover:shadow-lg"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-4 bg-green-100 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.045 6.79-3 9.5m-1-6a9 9 0 010-6m9 6a9 9 0 010-6m-9 6c0-1.657 1.343-3 3-3s3 1.343 3 3m-3 0v1.5m-3.343-1.657A4.502 4.502 0 0112 4.5c.83 0 1.613.138 2.352.383m-7.5 7.5a4.502 4.502 0 0113.5 0m-12 3h.01M12 21l-3-3m3 3l3-3"/></svg>
            </div>
            <h3 className="mb-3 text-xl font-semibold text-gray-900">Tecnología Innovadora</h3>
            <p className="text-gray-600">
              Implementamos firma con biometría (huella, facial) y blockchain para auditoría inmutable.
            </p>
          </motion.div>

          <motion.div
            variants={featureVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="p-8 transition-shadow duration-300 bg-white rounded-lg shadow-md hover:shadow-lg"
          >
            <div className="flex items-center justify-center w-12 h-12 mb-4 bg-yellow-100 rounded-lg">
               <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2-4h6m3 0v6m0 0v.5c0 1.1.9 2 2 2h.5a2 2 0 002-2v-.5a2 2 0 00-2-2H17z"/></svg>
            </div>
            <h3 className="mb-3 text-xl font-semibold text-gray-900">Precios y Planes Flexibles</h3>
            <p className="text-gray-600">
              Ofrecemos "pago por firma" y planes económicos para PYMES y freelancers, sin forzar suscripciones costosas.
            </p>
          </motion.div>
        </div>
      </section>

       {/* Benefits Section - Static */}
       <section className="px-4 py-16 mx-auto rounded-lg sm:px-6 lg:px-8 max-w-7xl bg-blue-50">
        <h2 className="mb-12 text-3xl font-bold text-center text-gray-900">
          Beneficios para tu Negocio
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="flex items-start">
             <div className="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
             </div>
             <div className="ml-4">
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Ahorra Tiempo y Costos</h3>
                <p className="text-gray-600">Agiliza la firma de documentos y reduce gastos en impresión, envío y archivo físico.</p>
             </div>
          </div>
           <div className="flex items-start">
             <div className="flex-shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.003 12.003 0 002.944 12H4c0 1.381.168 2.725.47 4H4.5l1.5-1.5a6 6 0 013-3v-2a6 6 0 0112 0v2a6 6 0 01-3 3l1.5 1.5h.03c.302-1.275.47-2.619.47-4zm-9 0a6 6 0 0112 0"/></svg>
             </div>
             <div className="ml-4">
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Mayor Seguridad Jurídica</h3>
                <p className="text-gray-600">Documentos con validez probatoria, sellos de tiempo y auditoría inmutable con blockchain.</p>
             </div>
          </div>
           <div className="flex items-start">
             <div className="flex-shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
             </div>
             <div className="ml-4">
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Experiencia de Usuario Intuitiva</h3>
                <p className="text-gray-600">Interfaz amigable, soporte localizado en español y guías para trámites comunes en México.</p>
             </div>
          </div>
           <div className="flex items-start">
             <div className="flex-shrink-0">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16L2 12l4-4"/></svg>
             </div>
             <div className="ml-4">
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Fácil Integración</h3>
                <p className="text-gray-600">API robusta para conectar DocuSense con tus sistemas existentes (Contpaq, Aspel, etc.).</p>
             </div>
          </div>
        </div>
      </section>



       {/* Use Cases Section */}
       <section className="px-4 py-16 mx-auto sm:px-6 lg:px-8 max-w-7xl">
         <h2 className="mb-12 text-3xl font-bold text-center text-gray-900">
           Casos de Uso en México
         </h2>
         <div className="grid gap-8 md:grid-cols-3">
           <motion.div
             variants={featureVariants}
             initial="hidden"
             whileInView="visible"
             viewport={{ once: true }}
             transition={{ duration: 0.6, delay: 0.1 }}
             className="p-8 transition-shadow duration-300 bg-white rounded-lg shadow-md hover:shadow-lg"
           >
              <h3 className="mb-3 text-xl font-semibold text-gray-900">Sector Fiscal (SAT)</h3>
              <p className="text-gray-600">Firma de CFDI, contratos laborales digitales, avisos fiscales y más, cumpliendo con requisitos del SAT.</p>
           </motion.div>
            <motion.div
             variants={featureVariants}
             initial="hidden"
             whileInView="visible"
             viewport={{ once: true }}
             transition={{ duration: 0.6, delay: 0.2 }}
             className="p-8 transition-shadow duration-300 bg-white rounded-lg shadow-md hover:shadow-lg"
           >
              <h3 className="mb-3 text-xl font-semibold text-gray-900">Sector Legal</h3>
              <p className="text-gray-600">Firma de contratos de arrendamiento, servicios profesionales, acuerdos de confidencialidad con validez legal.</p>
           </motion.div>
             <motion.div
             variants={featureVariants}
             initial="hidden"
             whileInView="visible"
             viewport={{ once: true }}
             transition={{ duration: 0.6, delay: 0.3 }}
             className="p-8 transition-shadow duration-300 bg-white rounded-lg shadow-md hover:shadow-lg"
           >
              <h3 className="mb-3 text-xl font-semibold text-gray-900">PYMES y Freelancers</h3>
              <p className="text-gray-600">Simplifica la firma de contratos con clientes, proveedores y empleados de forma económica y segura.</p>
           </motion.div>
         </div>
       </section>


      {/* Testimonials Section (Retained and slightly enhanced) */}
      <section className="px-4 py-16 mx-auto rounded-lg sm:px-6 lg:px-8 max-w-7xl bg-blue-50">
        <h2 className="mb-12 text-3xl font-bold text-center text-gray-900">
          Lo que dicen nuestros usuarios
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, rotateY: 90 }}
            whileInView={{ opacity: 1, rotateY: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="p-6 bg-white rounded-lg shadow-md"
          >
            <div className="flex items-center mb-4">
              <div className="flex items-center justify-center w-12 h-12 mr-4 bg-blue-200 rounded-full">
                <span className="font-bold text-blue-700">MS</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">María Sánchez</h3>
                <p className="text-sm text-gray-500">Contadora</p>
              </div>
            </div>
            <p className="text-gray-600">
              "DocuSense ha revolucionado la forma en que gestiono los documentos fiscales de mis clientes.
              La capacidad de extraer datos automáticamente me ahorra horas de trabajo cada semana."
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, rotateY: 90 }}
            whileInView={{ opacity: 1, rotateY: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-6 bg-white rounded-lg shadow-md"
          >
            <div className="flex items-center mb-4">
              <div className="flex items-center justify-center w-12 h-12 mr-4 bg-green-200 rounded-full">
                <span className="font-bold text-green-700">JL</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Juan López</h3>
                <p className="text-sm text-gray-500">Abogado</p>
              </div>
            </div>
            <p className="text-gray-600">
              "La organización por categorías y la búsqueda avanzada me permite encontrar cualquier
              documento legal en segundos. Una herramienta indispensable para mi bufete."
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 mx-auto text-center sm:px-6 lg:px-8 max-w-7xl">
        <h2 className="mb-6 text-3xl font-bold text-gray-900">
          Comienza a Firmar Documentos Digitalmente Hoy Mismo
        </h2>
        <p className="max-w-3xl mx-auto mb-8 text-xl text-gray-600">
          Regístrate gratis y descubre cómo DocuSense puede transformar la forma en que gestionas y firmas tus documentos con total validez legal en México.
        </p>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="inline-flex rounded-md shadow"
        >
          <Link to="/register" className="inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
            Crear Cuenta Gratis
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 text-white bg-gray-800 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 mx-auto max-w-7xl md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-xl font-bold">DocuSense</h3>
            <p className="text-gray-400">
              La plataforma para gestionar y firmar documentos de forma segura y legal en México.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-lg font-semibold">Producto</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Características</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Precios</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Casos de uso</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-lg font-semibold">Empresa</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Sobre nosotros</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Blog</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-lg font-semibold">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Aviso de Privacidad</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Términos de Servicio</a></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 mx-auto mt-8 text-center text-gray-400 border-t border-gray-700 max-w-7xl">
          <p>© 2025 DocuSense. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
