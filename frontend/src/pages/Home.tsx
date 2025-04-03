import { Link } from 'react-router-dom';
import useAuth from '../hooks/UseAuth';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
            <span className="text-blue-600">Docu</span>Sense <br/> <span className="text-xs text-blue-600">by Engine Core</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-10">
            Gestiona y analiza tus documentos de forma inteligente con tecnología de última generación
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            {isAuthenticated ? (
              <Link to="/dashboard" className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Comenzar Gratis
                </Link>
                <Link to="/login" className="inline-flex justify-center items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Iniciar Sesión
                </Link>
              </>
            )}
          </div>
          <div className="relative h-64 sm:h-80 md:h-96 max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-blue-100 rounded-lg shadow-lg p-4">
              <div className="h-full bg-white rounded border border-gray-200 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-20 h-20 text-blue-500 mx-auto opacity-50">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Características principales
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Almacenamiento Seguro</h3>
            <p className="text-gray-600">
              Guarda tus documentos importantes en una plataforma protegida y accesible desde cualquier lugar.
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Analítica Inteligente</h3>
            <p className="text-gray-600">
              Extrae información clave de tus documentos automáticamente con nuestro sistema de procesamiento.
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Organización Eficiente</h3>
            <p className="text-gray-600">
              Categoriza y encuentra tus documentos al instante con búsquedas avanzadas y metadatos personalizados.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-blue-50 rounded-lg">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Lo que dicen nuestros usuarios
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center mr-4">
                <span className="text-blue-700 font-bold">MS</span>
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
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center mr-4">
                <span className="text-green-700 font-bold">JL</span>
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
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">
          Comienza a organizar tus documentos hoy mismo
        </h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
          Regístrate gratis y descubre cómo DocuSense puede transformar la forma en que gestionas tus documentos.
        </p>
        <div className="inline-flex rounded-md shadow">
          <Link to="/register" className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
            Comenzar ahora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">DocuSense</h3>
            <p className="text-gray-400">
              La plataforma para gestionar y analizar documentos de forma inteligente.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Producto</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Características</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Precios</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Casos de uso</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Sobre nosotros</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Blog</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Privacidad</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Términos de servicio</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-gray-700 text-center text-gray-400">
          <p>© 2025 DocuSense. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;