import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend
} from 'recharts'
import { reportesService } from '../services/api'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const fmt = (n) => n
  ? `S/ ${parseFloat(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`
  : 'S/ 0.00'

const hoy = new Date()
const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`
const hoyStr = hoy.toISOString().split('T')[0]

export default function Reportes() {
  const anio = hoy.getFullYear()
  const [tab, setTab] = useState('mensual')

  // Gastos por mes
  const [gastosMes, setGastosMes] = useState([])
  const [anioSel, setAnioSel] = useState(anio)

  // Gastos por proyecto
  const [gastosProy, setGastosProy] = useState([])

  // Ranking proveedores
  const [proveedores, setProveedores] = useState([])

  // Filtros de fecha compartidos
  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoyStr)

  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Cargar gastos por mes al cambiar año
  useEffect(() => {
    setCargando(true)
    reportesService.gastosPorMes(anioSel)
      .then(r => {
        const datos = Array.from({ length: 12 }, (_, i) => {
          const enc = r.data.find(m => m.mes === i + 1)
          return {
            mes: MESES[i],
            total: enc ? parseFloat(enc.total_gastado || 0) : 0,
            facturas: enc?.cantidad_facturas || 0,
          }
        })
        setGastosMes(datos)
      })
      .catch(() => setError('Error cargando gastos por mes'))
      .finally(() => setCargando(false))
  }, [anioSel])

  // Cargar proyectos y proveedores al cambiar fechas
  useEffect(() => {
    if (!desde || !hasta) return
    setCargando(true)
    Promise.all([
      reportesService.gastosPorProyecto(desde, hasta),
      reportesService.rankingProveedores(desde, hasta),
    ]).then(([r1, r2]) => {
      setGastosProy(r1.data)
      setProveedores(r2.data)
    })
    .catch(() => setError('Error cargando datos'))
    .finally(() => setCargando(false))
  }, [desde, hasta])

  const tabs = [
    { id: 'mensual',     label: 'Gastos por mes' },
    { id: 'proyectos',   label: 'Por proyecto' },
    { id: 'proveedores', label: 'Proveedores' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Reportes</h2>
        <p className="text-sm text-gray-500 mt-0.5">Análisis de gastos y compras</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-jbm-600 text-jbm-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: GASTOS POR MES ── */}
      {tab === 'mensual' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Año:</label>
            <select
              value={anioSel}
              onChange={e => setAnioSel(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500"
            >
              {[anio, anio-1, anio-2].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 mb-4">Gasto mensual — {anioSel}</h3>
            {cargando ? (
              <div className="h-64 flex items-center justify-center text-gray-400">Cargando...</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={gastosMes} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(0)}k`} width={55} />
                  <Tooltip
                    formatter={(v) => [`S/ ${parseFloat(v).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 'Total']}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="total" fill="#4f46e5" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabla resumen mensual */}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Mes</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Facturas</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Total gastado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gastosMes.map((m, i) => (
                  <tr key={i} className={m.total > 0 ? 'hover:bg-gray-50' : 'text-gray-300'}>
                    <td className="px-4 py-2.5 font-medium">{m.mes}</td>
                    <td className="px-4 py-2.5 text-right">{m.facturas}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(m.total)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                  <td className="px-4 py-2.5">Total {anioSel}</td>
                  <td className="px-4 py-2.5 text-right">
                    {gastosMes.reduce((s, m) => s + m.facturas, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {fmt(gastosMes.reduce((s, m) => s + m.total, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: POR PROYECTO ── */}
      {tab === 'proyectos' && (
        <div className="space-y-4">
          {/* Filtros fecha */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Desde:</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Hasta:</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500" />
            </div>
          </div>

          {cargando ? (
            <div className="card p-8 text-center text-gray-400">Cargando...</div>
          ) : gastosProy.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              No hay datos para el período seleccionado
            </div>
          ) : (
            <>
              <div className="card p-4">
                <h3 className="font-semibold text-gray-800 mb-4">Gasto por proyecto</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={gastosProy.map(p => ({
                      nombre: p.proyecto.length > 20 ? p.proyecto.slice(0,18)+'…' : p.proyecto,
                      total: parseFloat(p.total_gastado || 0),
                      facturas: p.cantidad_facturas,
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }}
                      tickFormatter={v => `S/${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip
                      formatter={(v) => [`S/ ${parseFloat(v).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 'Total']}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Proyecto</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Facturas</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Total</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">% del total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const totalGeneral = gastosProy.reduce((s, p) => s + parseFloat(p.total_gastado || 0), 0)
                      return gastosProy.map((p, i) => {
                        const total = parseFloat(p.total_gastado || 0)
                        const pct = totalGeneral > 0 ? (total / totalGeneral * 100).toFixed(1) : 0
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium">{p.proyecto}</td>
                            <td className="px-4 py-2.5 text-right">{p.cantidad_facturas}</td>
                            <td className="px-4 py-2.5 text-right font-mono">{fmt(total)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                  <div className="bg-jbm-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: PROVEEDORES ── */}
      {tab === 'proveedores' && (
        <div className="space-y-4">
          {/* Filtros fecha */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Desde:</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Hasta:</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-jbm-500" />
            </div>
          </div>

          {cargando ? (
            <div className="card p-8 text-center text-gray-400">Cargando...</div>
          ) : proveedores.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              No hay datos para el período seleccionado
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Ranking de proveedores</h3>
                <p className="text-xs text-gray-500 mt-0.5">Ordenado por monto total facturado</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">Proveedor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600">RUC</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Facturas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Total facturado</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600">Última compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {proveedores.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{i+1}</td>
                      <td className="px-4 py-2.5 font-medium">{p.razon_social}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{p.ruc}</td>
                      <td className="px-4 py-2.5 text-right">{p.cantidad_facturas}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        {fmt(p.total_facturado)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                        {p.ultima_compra
                          ? new Date(p.ultima_compra).toLocaleDateString('es-PE')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
