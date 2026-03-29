import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { reportesService } from '../services/api'
import { useAuth } from '../context/AuthContext'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Dashboard() {
  const { usuario } = useAuth()
  const [resumen, setResumen] = useState(null)
  const [gastosMes, setGastosMes] = useState([])
  const [cargando, setCargando] = useState(true)
  const anio = new Date().getFullYear()

  useEffect(() => {
    Promise.all([
      reportesService.dashboard(),
      reportesService.gastosPorMes(anio),
    ]).then(([r1, r2]) => {
      setResumen(r1.data)
      // Asegurar 12 meses en el gráfico
      const datos = Array.from({ length: 12 }, (_, i) => {
        const encontrado = r2.data.find(m => m.mes === i + 1)
        return {
          mes: MESES[i],
          total: encontrado ? parseFloat(encontrado.total_gastado || 0) : 0,
          facturas: encontrado?.cantidad_facturas || 0,
        }
      })
      setGastosMes(datos)
      }).catch(() => null).finally(() => setCargando(false))    }).finally(() => setCargando(false))
  }, [])

  const fmt = (n) => n ? `S/ ${parseFloat(n).toLocaleString('es-PE', { minimumFractionDigits: 2 })}` : 'S/ 0.00'

  const variacion = resumen?.gasto_mes_anterior > 0
    ? ((resumen.gasto_este_mes - resumen.gasto_mes_anterior) / resumen.gasto_mes_anterior * 100).toFixed(1)
    : null

  if (cargando) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>
  )

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Hola, {usuario?.nombre?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Gasto este mes</p>
          <p className="text-lg font-bold text-gray-900">{fmt(resumen?.gasto_este_mes)}</p>
          {variacion !== null && (
            <p className={`text-xs mt-1 ${parseFloat(variacion) > 0 ? 'text-red-500' : 'text-green-600'}`}>
              {parseFloat(variacion) > 0 ? '▲' : '▼'} {Math.abs(variacion)}% vs mes anterior
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Facturas este mes</p>
          <p className="text-lg font-bold text-gray-900">{resumen?.facturas_este_mes || 0}</p>
          <p className="text-xs text-gray-400 mt-1">documentos</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Mes anterior</p>
          <p className="text-lg font-bold text-gray-900">{fmt(resumen?.gasto_mes_anterior)}</p>
          <p className="text-xs text-gray-400 mt-1">{resumen?.facturas_mes_anterior || 0} facturas</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Pendientes de revisar</p>
          <p className={`text-lg font-bold ${resumen?.facturas_pendientes > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {resumen?.facturas_pendientes || 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">facturas</p>
        </div>
      </div>

      {/* Gráfico gastos por mes */}
      <div className="card p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Gastos por mes — {anio}</h3>
          <Link to="/reportes" className="text-xs text-jbm-600 hover:underline">Ver reportes →</Link>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={gastosMes} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(0)}k`} width={50} />
            <Tooltip
              formatter={(value) => [`S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, 'Total']}
              labelStyle={{ fontWeight: 600 }}
            />
            <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Accesos rápidos */}
      <div>
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">Accesos rápidos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/subir',    icono: '⬆️',  label: 'Subir factura' },
            { href: '/facturas', icono: '🧾', label: 'Ver facturas' },
            { href: '/catalogo', icono: '📦', label: 'Catálogo precios' },
            { href: '/reportes', icono: '📈', label: 'Reportes' },
          ].map(item => (
            <Link key={item.href} to={item.href}
              className="card p-4 text-center hover:shadow-md transition-shadow hover:border-jbm-200 group">
              <div className="text-2xl mb-2">{item.icono}</div>
              <p className="text-xs font-medium text-gray-700 group-hover:text-jbm-600">{item.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
