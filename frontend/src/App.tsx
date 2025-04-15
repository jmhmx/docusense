import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './components/Login'
import Register from './components/Register'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import AuthProvider from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import DocumentViewer from './pages/DocumentViewer'
import SharedDocumentView from './pages/SharedDocumentView'
import Home from './pages/Home'
import DebugHelper from './components/DebugHelper'
import BiometricRegistration from './pages/BiometricRegistration'


function App() {
   // Determinar si estamos en ambiente de desarrollo
  const isDev = true;
  return (
     <BrowserRouter>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-gray-50">
          <Navbar />
          <div className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/documents/:id" element={<ProtectedRoute><DocumentViewer /></ProtectedRoute>} />
              <Route path="/share/:token" element={<SharedDocumentView />} />
              <Route path="/biometric-registration" element={<ProtectedRoute><BiometricRegistration /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          {isDev && <DebugHelper />}
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App