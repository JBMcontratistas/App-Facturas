import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import { catalogoService } from '../services/api'

const fmt = (n) => n
  ? `S/ ${parseFloat(n).toLocaleString('es-PE', { minimumFractionDigits: 4 })}`
  : '—'

export default function Catalogo() {
  const [categorias, setCategorias]     = useState([])
  const [materiales, setMateriales]     = useState([])
  const [catSel, setCatSel]             = useState(null)
  const [buscar, setBuscar]             = useState('')
  const [materialSel, setMaterialSel]   = useState(null)
  const [historial, setHistorial]       = useState([])
  const [cargando, setCargando]         = useState(false)
  const [modalNuevo, setModalNuevo]     = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState(false)

  const [form, setForm] = useState({
    nombre_normalizado: '', categoria_id: '', unidad_estandar: '', descripcion: '', _nuevaCategoriaTexto: ''
  })
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)

  useEffect(() => {
    catalogoService.categorias().then(r => setCategorias(r.data))
  }, [])

  useEffect(() => {
    setCargando(true)
    catalogoService.materiales({
      categoria_id: catSel || undefined,
      buscar: buscar || undefined,
    })
      .then(r => setMateriales(r.data))
      .finally(() => setCargando(false))
  }, [catSel, buscar])

  useEffect(() => {
    if (!materialSel) return
    catalogoService.historialPrecios(materialSel.id)
      .then(r => setHistorial(r.data))
  }, [materialSel])

  const handleGuardar = async () => {
    if (!form.nombre_normalizado) {
      setErrorForm('El nombre es obligatorio')
      return
    }
    setGuardando(true)
    setErrorForm(null)

    let categoria_id = form.categoria_id

    if (nuevaCategoria) {
      if (!form._nuevaCategoriaTexto) {
        setErrorForm('Escribe el nombre de la nueva categoría')
        setGuardando(false)
        return
      }
      try {
        const r = await catalogoService.crearCategoria({ nombre: form._nuevaCategoriaTexto })
        const nuevaCat = r.data
        setCategorias(prev => [...prev, nuevaCat])
        categoria_id = String(nuevaCat.id)
        setNuevaCategoria(false)
      } catch (e) {
        setErrorForm('Error creando categoría')
        setGuardando(false)
        return
      }
    }

    if (!categoria_id) {
      setErrorForm('Selecciona o crea una categoría')
      setGuardando(false)
      return
    }

    try {
      await catalogoService.crearMaterial({
        nombre_normalizado: form.nombre_normalizado,
        categoria_id: parseInt(categoria_id),
        unidad_estandar: form.unidad_estandar,
        descripcion: form.descripcion,
      })
      setModalNuevo(false)
      setNuevaCategoria(false)
      setForm({ nombre_normalizado: '', categoria_id: '', unidad_estandar: '', descripcion: '', _nuevaCategoriaTexto: '' })
      const r = await catalogoService.materiales({
        categoria_id: catSel || undefined,
        buscar: buscar || undefined,
      })
      setMateriales(r.data)
    } catch (e) {
      setErrorForm(e.response?.data?.detail || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Catálogo de materiales</h2>
          <p className="text-sm text-gray-500 mt-0.5">Historial de precios por material</p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="bg-jbm-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-jbm-700 transition-colors"
        >
          + Nuevo material
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0 space-y-3">
          <input
            type="text"
            placeholder="Buscar material..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
          />

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCatSel(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                catSel === null ? 'bg-jbm-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            {categorias.map(c => (
              <button
                key={c.id}
                onClick={() => setCatSel(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  catSel === c.id ? 'bg-jbm-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          <div className="card divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
            {cargando ? (
              <div className="p-6 text-center text-gray-400 text-sm">Cargando...</div>
            ) : materiales.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                No hay materiales{buscar ? ' con ese nombre' : ''}
              </div>
            ) : (
              materiales.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMaterialSel(m)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    materialSel?.id === m.id ? 'bg-jbm-50 border-l-2 border-jbm-500' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{m.nombre_normalizado}</p>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-xs text-gray-400">{m.categoria} · {m.unidad_estandar || '—'}</span>
                    <span className="text-xs text-gray-500">{m.total_compras} compras</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1">
          {!materialSel ? (
            <div className="card p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📦</div>
              <p className="text-sm">Selecciona un material para ver su historial de precios</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{materialSel.nombre_normalizado}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {materialSel.categoria} · {materialSel.unidad_estandar || 'sin unidad'}
                    </p>
                  </div>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                    {materialSel.total_compras} compras
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-600 mb-1">Precio mínimo</p>
                    <p className="font-semibold text-green-700">{fmt(materialSel.precio_minimo)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 mb-1">Precio promedio</p>
                    <p className="font-semibold text-blue-700">{fmt(materialSel.precio_promedio)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-600 mb-1">Precio máximo</p>
                    <p className="font-semibold text-red-700">{fmt(materialSel.precio_maximo)}</p>
                  </div>
                </div>
              </div>

              {historial.length > 1 && (
                <div className="card p-4">
                  <h4 className="font-medium text-gray-800 mb-3 text-sm">Evolución de precios</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart
                      data={historial.map(h => ({
                        fecha: new Date(h.fecha_emision).toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }),
                        precio: parseFloat(h.precio_unit_sin_igv),
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={v => `S/${v.toFixed(2)}`} />
                      <Tooltip formatter={(v) => [`S/ ${parseFloat(v).toFixed(4)}`, 'Precio s/IGV']} />
                      <Line type="monotone" dataKey="precio" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h4 className="font-medium text-gray-800 text-sm">Historial de compras</h4>
                </div>
                {historial.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    Sin compras registradas aún
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Fecha</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">Proveedor</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">Cantidad</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-600">Precio s/IGV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {historial.map((h, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-500 text-xs">
                            {new Date(h.fecha_emision).toLocaleDateString('es-PE')}
                          </td>
                          <td className="px-4 py-2.5 font-medium">{h.proveedor}</td>
                          <td className="px-4 py-2.5 text-right">{parseFloat(h.cantidad).toLocaleString('es-PE')}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{fmt(h.precio_unit_sin_igv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {modalNuevo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Nuevo material</h3>
              <button onClick={() => { setModalNuevo(false); setNuevaCategoria(false) }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {errorForm && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {errorForm}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre normalizado <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nombre_normalizado}
                  onChange={e => setForm(f => ({ ...f, nombre_normalizado: e.target.value }))}
                  placeholder="Ej: CAUCHO GRANULADO"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoría <span className="text-red-500">*</span>
                </label>
                {!nuevaCategoria ? (
                  <div className="flex gap-2">
                    <select
                      value={form.categoria_id}
                      onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                    >
                      <option value="">Seleccionar...</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setNuevaCategoria(true)}
                      className="text-xs text-jbm-600 hover:underline whitespace-nowrap px-2"
                    >
                      + Nueva
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form._nuevaCategoriaTexto || ''}
                      onChange={e => setForm(f => ({ ...f, _nuevaCategoriaTexto: e.target.value }))}
                      placeholder="Nombre de nueva categoría"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                    />
                    <button
                      onClick={() => setNuevaCategoria(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad estándar</label>
                <input
                  type="text"
                  value={form.unidad_estandar}
                  onChange={e => setForm(f => ({ ...f, unidad_estandar: e.target.value }))}
                  placeholder="Ej: KG, M2, UND"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => { setModalNuevo(false); setNuevaCategoria(false) }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="bg-jbm-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-jbm-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
