import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Facturas from './pages/Facturas'
import SubirFactura from './pages/SubirFactura'
import Proyectos from './pages/Proyectos'

// Páginas stub — se desarrollan en Fase 2 y 3
import Catalogo from './pages/Catalogo'
import Reportes from './pages/Reportes'
const Usuarios   = () => <div className="card p-8 text-center text-gray-400">Gestión de usuarios — próximamente</div>
const DetalleFactura = () => <div className="card p-8 text-center text-gray-400">Detalle de factura — próximamente</div>

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      Cargando...
    </div>
  )
  if (!usuario) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RutaProtegida><Dashboard /></RutaProtegida>} />
          <Route path="/facturas" element={<RutaProtegida><Facturas /></RutaProtegida>} />
          <Route path="/facturas/:id" element={<RutaProtegida><DetalleFactura /></RutaProtegida>} />
          <Route path="/subir" element={<RutaProtegida><SubirFactura /></RutaProtegida>} />
          <Route path="/proyectos" element={<RutaProtegida><Proyectos /></RutaProtegida>} />
          <Route path="/catalogo" element={<RutaProtegida><Catalogo /></RutaProtegida>} />
          <Route path="/reportes" element={<RutaProtegida><Reportes /></RutaProtegida>} />
          <Route path="/usuarios" element={<RutaProtegida><Usuarios /></RutaProtegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
