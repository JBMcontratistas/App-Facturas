import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { facturasService, proyectosService } from '../services/api'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [proyectos, setProyectos] = useState([])
  const [filtros, setFiltros] = useState({
    proyecto_id: '', desde: '', hasta: '', estado: ''
  })

  useEffect(() => {
    proyectosService.listar().then(r => setProyectos(r.data))
  }, [])

  useEffect(() => {
    cargar()
  }, [pagina, filtros])

  const cargar = async () => {
    setCargando(true)
    try {
      const params = { pagina, por_pagina: 20 }
      if (filtros.proyecto_id) params.proyecto_id = filtros.proyecto_id
      if (filtros.desde) params.desde = filtros.desde
      if (filtros.hasta) params.hasta = filtros.hasta
      if (filtros.estado) params.estado = filtros.estado
      const res = await facturasService.listar(params)
      setFacturas(res.data.facturas)
      setTotal(res.data.total)
    } finally {
      setCargando(false)
    }
  }

  const limpiarFiltros = () => {
    setFiltros({ proyecto_id: '', desde: '', hasta: '', estado: '' })
    setPagina(1)
  }

  const totalPaginas = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Facturas</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} registros encontrados</p>
        </div>
        <Link to="/subir" className="btn-primary shrink-0">⬆️ Subir factura</Link>
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Proyecto</label>
            <select className="input" value={filtros.proyecto_id}
              onChange={e => { setFiltros(f => ({...f, proyecto_id: e.target.value})); setPagina(1) }}>
              <option value="">Todos</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={filtros.estado}
              onChange={e => { setFiltros(f => ({...f, estado: e.target.value})); setPagina(1) }}>
              <option value="">Todos</option>
              <option value="verificada">Verificada</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
          <div>
            <label className="label">Desde</label>
            <input type="date" className="input" value={filtros.desde}
              onChange={e => { setFiltros(f => ({...f, desde: e.target.value})); setPagina(1) }} />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input type="date" className="input" value={filtros.hasta}
              onChange={e => { setFiltros(f => ({...f, hasta: e.target.value})); setPagina(1) }} />
          </div>
        </div>
        <button onClick={limpiarFiltros} className="text-xs text-jbm-600 hover:underline mt-2">
          Limpiar filtros
        </button>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="card p-12 text-center text-gray-400">Cargando...</div>
      ) : facturas.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400">No hay facturas con estos filtros</p>
          <Link to="/subir" className="btn-primary mt-4 inline-flex">Subir primera factura</Link>
        </div>
      ) : (
        <>
          {/* Tabla desktop */}
          <div className="card hidden sm:block overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Factura</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proveedor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Proyecto</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/facturas/${f.id}`} className="font-medium text-jbm-600 hover:underline">
                        {f.numero_factura}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                      {f.proveedor?.razon_social}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {f.fecha_emision ? format(new Date(f.fecha_emision), 'd MMM yyyy', { locale: es }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {f.proyectos?.map(p => p.nombre).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      S/ {f.total?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`badge-${f.estado_verificacion}`}>
                        {f.estado_verificacion === 'verificada' ? '✓ Verificada' : '⏳ Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas móvil */}
          <div className="sm:hidden space-y-3">
            {facturas.map(f => (
              <Link key={f.id} to={`/facturas/${f.id}`} className="card p-4 block hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-jbm-600 text-sm">{f.numero_factura}</span>
                  <span className={`badge-${f.estado_verificacion}`}>
                    {f.estado_verificacion === 'verificada' ? '✓' : '⏳'}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 truncate">{f.proveedor?.razon_social}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-400">
                    {f.fecha_emision ? format(new Date(f.fecha_emision), 'd MMM yyyy', { locale: es }) : '—'}
                  </span>
                  <span className="font-bold text-gray-900">
                    S/ {f.total?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {f.proyectos?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    📁 {f.proyectos.map(p => p.nombre).join(', ')}
                  </p>
                )}
              </Link>
            ))}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPagina(p => Math.max(1, p-1))}
                disabled={pagina === 1} className="btn-secondary px-3 py-2">←</button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                {pagina} / {totalPaginas}
              </span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p+1))}
                disabled={pagina === totalPaginas} className="btn-secondary px-3 py-2">→</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
