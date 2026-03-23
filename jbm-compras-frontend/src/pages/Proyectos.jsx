import { useState, useEffect } from 'react'
import { proyectosService } from '../services/api'

export default function Proyectos() {
  const [proyectos, setProyectos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
  })

  const cargarProyectos = async () => {
    try {
      const r = await proyectosService.listar()
      setProyectos(r.data)
    } catch {
      setError('Error al cargar proyectos')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarProyectos() }, [])

  const handleChange = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }))
  }

  const handleCrear = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre del proyecto es obligatorio')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await proyectosService.crear({
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || null,
        descripcion: form.descripcion.trim() || null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
      })
      setForm({ nombre: '', codigo: '', descripcion: '', fecha_inicio: '', fecha_fin: '' })
      setMostrarForm(false)
      await cargarProyectos()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el proyecto')
    } finally {
      setGuardando(false)
    }
  }

  const handleCerrar = async (id) => {
    try {
      await proyectosService.actualizar(id, { estado: 'cerrado' })
      await cargarProyectos()
    } catch {
      setError('Error al cerrar el proyecto')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Proyectos</h2>
          <p className="text-sm text-gray-500 mt-1">Centros de costo para asignación de facturas</p>
        </div>
        <button
          onClick={() => { setMostrarForm(v => !v); setError('') }}
          className="btn-primary"
        >
          {mostrarForm ? '✕ Cancelar' : '+ Nuevo proyecto'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Formulario crear */}
      {mostrarForm && (
        <div className="card p-4 mb-6 space-y-3">
          <h3 className="font-semibold text-gray-800">Nuevo proyecto</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Nombre del proyecto *</label>
              <input
                className="input"
                placeholder="Ej: Cancha Sintética Club Lima"
                value={form.nombre}
                onChange={e => handleChange('nombre', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Código (opcional)</label>
              <input
                className="input"
                placeholder="Ej: PRY-2026-001"
                value={form.codigo}
                onChange={e => handleChange('codigo', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Descripción (opcional)</label>
              <input
                className="input"
                placeholder="Breve descripción..."
                value={form.descripcion}
                onChange={e => handleChange('descripcion', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Fecha inicio</label>
              <input
                type="date"
                className="input"
                value={form.fecha_inicio}
                onChange={e => handleChange('fecha_inicio', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Fecha fin estimada</label>
              <input
                type="date"
                className="input"
                value={form.fecha_fin}
                onChange={e => handleChange('fecha_fin', e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={handleCrear}
            disabled={guardando}
            className="btn-primary w-full mt-2"
          >
            {guardando ? 'Guardando...' : '✅ Crear proyecto'}
          </button>
        </div>
      )}

      {/* Lista de proyectos */}
      {cargando ? (
        <div className="text-center text-gray-400 py-12">Cargando proyectos...</div>
      ) : proyectos.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <div className="text-4xl mb-3">📁</div>
          <p className="font-medium">No hay proyectos activos</p>
          <p className="text-sm mt-1">Crea tu primer proyecto para empezar a asignar facturas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proyectos.map(p => (
            <div key={p.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{p.nombre}</span>
                  {p.codigo && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {p.codigo}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {p.estado}
                  </span>
                </div>
                {p.fecha_inicio && (
                  <p className="text-xs text-gray-400 mt-1">
                    {p.fecha_inicio} {p.fecha_fin ? `→ ${p.fecha_fin}` : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleCerrar(p.id)}
                className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                title="Cerrar proyecto"
              >
                Cerrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
