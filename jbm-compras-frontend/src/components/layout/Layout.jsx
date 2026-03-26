import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { href: '/',          icono: '📊', label: 'Dashboard',      roles: ['administrador','jefe_proyecto','gerencia','contador','asistente','invitado'] },
  { href: '/facturas',  icono: '🧾', label: 'Facturas',       roles: ['administrador','jefe_proyecto','gerencia','contador','asistente','invitado'] },
  { href: '/subir',     icono: '⬆️',  label: 'Subir factura',  roles: ['administrador','jefe_proyecto','asistente'] },
  { href: '/proyectos', icono: '🏗️',  label: 'Proyectos',     roles: ['administrador','gerencia','jefe_proyecto'] },
  { href: '/catalogo',  icono: '📦', label: 'Catálogo',       roles: ['administrador','jefe_proyecto','gerencia','contador','asistente'] },
  { href: '/reportes',  icono: '📈', label: 'Reportes',       roles: ['administrador','gerencia','contador','jefe_proyecto','asistente','invitado'] },
  { href: '/usuarios',  icono: '👥', label: 'Usuarios',       roles: ['administrador'] },
]

export default function Layout({ children }) {
  const { usuario, logout, esAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const navFiltrado = NAV.filter(n => n.roles.includes(usuario?.rol))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NavLink = ({ item }) => {
    const activo = location.pathname === item.href ||
      (item.href !== '/' && location.pathname.startsWith(item.href))
    return (
      <Link
        to={item.href}
        onClick={() => setMenuAbierto(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          activo
            ? 'bg-jbm-600 text-white'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <span className="text-base">{item.icono}</span>
        {item.label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Sidebar desktop ───────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:min-h-screen bg-white border-r border-gray-200 p-4">
        {/* Logo */}
        <div className="mb-6 px-2">
          <h1 className="text-lg font-bold text-jbm-700">JBM Compras</h1>
          <p className="text-xs text-gray-400 mt-0.5">Sistema de gestión</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {navFiltrado.map(item => <NavLink key={item.href} item={item} />)}
        </nav>

        {/* Usuario */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="px-2 mb-2">
            <p className="text-sm font-medium text-gray-800 truncate">{usuario?.nombre}</p>
            <p className="text-xs text-gray-400 capitalize">{usuario?.rol?.replace('_', ' ')}</p>
          </div>
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Header móvil ──────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-30">
        <h1 className="text-base font-bold text-jbm-700">JBM Compras</h1>
        <button
          onClick={() => setMenuAbierto(!menuAbierto)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Menú"
        >
          <div className="w-5 h-0.5 bg-gray-600 mb-1 transition-all" />
          <div className="w-5 h-0.5 bg-gray-600 mb-1" />
          <div className="w-5 h-0.5 bg-gray-600" />
        </button>
      </div>

      {/* ── Menú móvil (overlay) ──────────────────── */}
      {menuAbierto && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <div className="relative bg-white w-64 min-h-screen p-4 flex flex-col shadow-xl">
            <div className="mb-6 px-2">
              <h1 className="text-lg font-bold text-jbm-700">JBM Compras</h1>
              <p className="text-xs text-gray-400 mt-0.5">{usuario?.nombre}</p>
            </div>
            <nav className="flex-1 space-y-1">
              {navFiltrado.map(item => <NavLink key={item.href} item={item} />)}
            </nav>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contenido principal ───────────────────── */}
      <main className="flex-1 p-4 lg:p-6 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  )
}
