import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-jbm-50 to-jbm-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-jbm-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🏗️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">JBM Compras</h1>
          <p className="text-sm text-gray-500 mt-1">JBM Contratistas Generales S.A.C.</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="usuario@jbm.pe"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={cargando}
            >
              {cargando ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Ingresando...
                </span>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Sistema interno — solo personal autorizado
        </p>
      </div>
    </div>
  )
}
