import { useState, useEffect } from 'react'
import { authService } from '../services/api'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'jefe_proyecto', label: 'Jefe de proyecto' },
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'contador', label: 'Contador' },
  { value: 'asistente', label: 'Asistente' },
  { value: 'invitado', label: 'Invitado' },
]

export default function Usuarios() {
  const { usuario: usuarioActual } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const [exito, setExito] = useState(false)

  const [form, setForm] = useState({
    nombre: '', email: '', password: '', rol: 'jefe_proyecto'
  })

  const cargarUsuarios = () => {
    setCargando(true)
    authService.listarUsuarios()
      .then(r => setUsuarios(r.data))
      .catch(() => setError('No tienes permiso para ver esta sección'))
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargarUsuarios() }, [])

  const handleGuardar = async () => {
    if (!form.nombre || !form.email || !form.password) {
      setErrorForm('Nombre, email y contraseña son obligatorios')
      return
    }
    if (form.password.length < 6) {
      setErrorForm('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setGuardando(true)
    setErrorForm(null)
    try {
      await authService.crearUsuario(form)
      setExito(true)
      setForm({ nombre: '', email: '', password: '', rol: 'jefe_proyecto' })
      cargarUsuarios()
      setTimeout(() => {
        setExito(false)
        setModalNuevo(false)
      }, 1500)
    } catch (e) {
      setErrorForm(e.response?.data?.detail || 'Error al crear usuario')
    } finally {
      setGuardando(false)
    }
  }

  const rolLabel = (rol) => ROLES.find(r => r.value === rol)?.label || rol

  const rolColor = (rol) => {
    if (rol === 'admin') return 'bg-purple-100 text-purple-700'
    if (rol === 'contador') return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
  }

  if (error) return (
    <div className="card p-8 text-center text-red-500">{error}</div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestión de usuarios</h2>
          <p className="text-sm text-gray-500 mt-0.5">Solo administradores pueden gestionar usuarios</p>
        </div>
        {(usuarioActual?.rol === 'admin' || usuarioActual?.rol === 'administrador') && (
          <button
            onClick={() => setModalNuevo(true)}
            className="bg-jbm-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-jbm-700 transition-colors"
          >
            + Nuevo usuario
          </button>
        )}
      </div>

      {cargando ? (
        <div className="card p-8 text-center text-gray-400">Cargando...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {u.nombre}
                    {u.id === usuarioActual?.id && (
                      <span className="ml-2 text-xs text-jbm-600 font-normal">(tú)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rolColor(u.rol)}`}>
                      {rolLabel(u.rol)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo usuario */}
      {modalNuevo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Nuevo usuario</h3>
              <button onClick={() => setModalNuevo(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {exito && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                  ✅ Usuario creado correctamente
                </div>
              )}
              {errorForm && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {errorForm}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: Juan Pérez"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="usuario@jbmcg.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={form.rol}
                  onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setModalNuevo(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="bg-jbm-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-jbm-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
