import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { facturasService, proyectosService, catalogoService } from '../services/api'

const PASOS = ['Subir PDF', 'Verificar datos', 'Asignar proyecto', 'Confirmar']

export default function SubirFactura() {
  const [paso, setPaso] = useState(0)
  const [archivo, setArchivo] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [datosExtraidos, setDatosExtraidos] = useState(null)
  const [tieneAlertas, setTieneAlertas] = useState(false)
  const [proyectos, setProyectos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [asignaciones, setAsignaciones] = useState([{ proyecto_id: '', porcentaje: 100, monto: '', nota: '' }])
  const [guardado, setGuardado] = useState(null)

  useEffect(() => {
    proyectosService.listar().then(r => setProyectos(r.data))
    catalogoService.categorias().then(r => setCategorias(r.data))
  }, [])

  // ── Paso 1: Dropzone ──────────────────────────────────
  const onDrop = useCallback(files => {
    if (files[0]) setArchivo(files[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const procesarPdf = async () => {
    if (!archivo) return
    setCargando(true)
    setError('')
    try {
      const res = await facturasService.extraer(archivo)
      setDatosExtraidos(res.data.datos)
      setTieneAlertas(res.data.tiene_alertas)
      setPaso(1)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar el PDF')
    } finally {
      setCargando(false)
    }
  }

  // ── Paso 3: Asignaciones ──────────────────────────────
  const agregarAsignacion = () => {
    setAsignaciones(a => [...a, { proyecto_id: '', porcentaje: '', monto: '', nota: '' }])
  }

  const actualizarAsignacion = (i, campo, valor) => {
    setAsignaciones(a => a.map((item, idx) => idx === i ? { ...item, [campo]: valor } : item))
  }

  const eliminarAsignacion = (i) => {
    setAsignaciones(a => a.filter((_, idx) => idx !== i))
  }

  // ── Paso 4: Guardar ───────────────────────────────────
  const guardar = async () => {
    setCargando(true)
    setError('')
    try {
      const payload = {
        numero_factura: datosExtraidos.numero_factura,
        tipo_documento: datosExtraidos.tipo_documento || 'factura',
        proveedor_ruc: datosExtraidos.proveedor?.ruc,
        proveedor_razon_social: datosExtraidos.proveedor?.razon_social,
        proveedor_direccion: datosExtraidos.proveedor?.direccion,
        fecha_emision: datosExtraidos.fecha_emision,
        fecha_vencimiento: datosExtraidos.fecha_vencimiento,
        moneda: datosExtraidos.moneda || 'PEN',
        op_gravada: datosExtraidos.op_gravada || 0,
        op_inafecta: datosExtraidos.op_inafecta || 0,
        op_exonerada: datosExtraidos.op_exonerada || 0,
        igv: datosExtraidos.igv || 0,
        total: datosExtraidos.total,
        condicion_pago: datosExtraidos.condicion_pago,
        nota: datosExtraidos.nota_libre || '',
        confianza_ia: datosExtraidos.confianza_general,
        items: (datosExtraidos.items || []).map((item, i) => ({
          linea: item.linea || i + 1,
          descripcion: item.descripcion,
          unidad: item.unidad,
          cantidad: item.cantidad,
          precio_unit_con_igv: item.precio_unit_con_igv,
          precio_unit_sin_igv: item.precio_unit_sin_igv,
          subtotal: item.subtotal,
          categoria_id: item.categoria_id || null,
        })),
        asignaciones: asignaciones
          .filter(a => a.proyecto_id)
          .map(a => ({
            proyecto_id: parseInt(a.proyecto_id),
            porcentaje: a.porcentaje ? parseFloat(a.porcentaje) : null,
            monto: a.monto ? parseFloat(a.monto) : null,
            nota: a.nota || null,
          })),
      }

      const res = await facturasService.guardar(payload)
      const facturaId = res.data.factura_id

      // Subir PDF a OneDrive
      await facturasService.subirPdf(facturaId, archivo)

      setGuardado({ facturaId })
      setPaso(4)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar la factura')
    } finally {
      setCargando(false)
    }
  }

  const reiniciar = () => {
    setPaso(0)
    setArchivo(null)
    setDatosExtraidos(null)
    setTieneAlertas(false)
    setAsignaciones([{ proyecto_id: '', porcentaje: 100, monto: '', nota: '' }])
    setGuardado(null)
    setError('')
  }

  // ── Helpers UI ────────────────────────────────────────
  const campoConAlerta = (campo) =>
    datosExtraidos?.campos_baja_confianza?.includes(campo)

  const actualizarDato = (ruta, valor) => {
    setDatosExtraidos(prev => {
      const nuevo = { ...prev }
      const partes = ruta.split('.')
      let obj = nuevo
      for (let i = 0; i < partes.length - 1; i++) {
        obj[partes[i]] = { ...obj[partes[i]] }
        obj = obj[partes[i]]
      }
      obj[partes[partes.length - 1]] = valor
      return nuevo
    })
  }

  const actualizarItem = (idx, campo, valor) => {
    setDatosExtraidos(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [campo]: valor } : it)
    }))
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="max-w-3xl mx-auto">

      {/* Título */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Subir factura</h2>
        <p className="text-sm text-gray-500 mt-1">Carga un PDF y el sistema extrae los datos automáticamente</p>
      </div>

      {/* Indicador de pasos */}
      {paso < 4 && (
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {PASOS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                i === paso ? 'bg-jbm-600 text-white' :
                i < paso  ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-400'
              }`}>
                {i < paso && <span>✓</span>}
                {i + 1}. {label}
              </div>
              {i < PASOS.length - 1 && <div className="w-4 h-px bg-gray-200 shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* ── PASO 0: SUBIR ───────────────────────────── */}
      {paso === 0 && (
        <div className="card p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-jbm-500 bg-jbm-50' : 'border-gray-300 hover:border-jbm-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="text-4xl mb-3">📄</div>
            {archivo ? (
              <div>
                <p className="font-medium text-gray-800">{archivo.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(archivo.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-700">
                  {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu factura PDF aquí'}
                </p>
                <p className="text-sm text-gray-400 mt-1">o toca para seleccionar desde tu dispositivo</p>
                <p className="text-xs text-gray-300 mt-2">Solo PDF · Máximo 10 MB</p>
              </div>
            )}
          </div>

          {archivo && (
            <button
              onClick={procesarPdf}
              disabled={cargando}
              className="btn-primary w-full mt-4 py-3"
            >
              {cargando ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Procesando con IA...
                </>
              ) : '🤖 Extraer datos con IA'}
            </button>
          )}
        </div>
      )}

      {/* ── PASO 1: VERIFICAR ───────────────────────── */}
      {paso === 1 && datosExtraidos && (
        <div className="space-y-4">
          {tieneAlertas && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800 flex gap-2">
              <span className="shrink-0">⚠️</span>
              <span>Algunos campos tienen baja confianza y están resaltados. Revísalos antes de continuar.</span>
            </div>
          )}

          {/* Cabecera factura */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 mb-4">Datos del proveedor y factura</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">RUC proveedor</label>
                <input className={campoConAlerta('proveedor.ruc') ? 'input-alerta' : 'input'}
                  value={datosExtraidos.proveedor?.ruc || ''}
                  onChange={e => actualizarDato('proveedor.ruc', e.target.value)} />
              </div>
              <div>
                <label className="label">Razón social</label>
                <input className={campoConAlerta('proveedor.razon_social') ? 'input-alerta' : 'input'}
                  value={datosExtraidos.proveedor?.razon_social || ''}
                  onChange={e => actualizarDato('proveedor.razon_social', e.target.value)} />
              </div>
              <div>
                <label className="label">N° de factura</label>
                <input className={campoConAlerta('numero_factura') ? 'input-alerta' : 'input'}
                  value={datosExtraidos.numero_factura || ''}
                  onChange={e => actualizarDato('numero_factura', e.target.value)} />
              </div>
              <div>
                <label className="label">Tipo de documento</label>
                <select className="input" value={datosExtraidos.tipo_documento || 'factura'}
                  onChange={e => actualizarDato('tipo_documento', e.target.value)}>
                  <option value="factura">Factura electrónica</option>
                  <option value="recibo_honorarios">Recibo por honorarios</option>
                  <option value="boleta">Boleta</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="label">Fecha de emisión</label>
                <input type="date" className={campoConAlerta('fecha_emision') ? 'input-alerta' : 'input'}
                  value={datosExtraidos.fecha_emision || ''}
                  onChange={e => actualizarDato('fecha_emision', e.target.value)} />
              </div>
              <div>
                <label className="label">Fecha de vencimiento</label>
                <input type="date" className="input"
                  value={datosExtraidos.fecha_vencimiento || ''}
                  onChange={e => actualizarDato('fecha_vencimiento', e.target.value)} />
              </div>
              <div>
                <label className="label">Total S/</label>
                <input type="number" step="0.01" className={campoConAlerta('total') ? 'input-alerta' : 'input'}
                  value={datosExtraidos.total || ''}
                  onChange={e => actualizarDato('total', parseFloat(e.target.value))} />
              </div>
              <div>
                <label className="label">IGV S/</label>
                <input type="number" step="0.01" className="input"
                  value={datosExtraidos.igv || ''}
                  onChange={e => actualizarDato('igv', parseFloat(e.target.value))} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Nota (opcional)</label>
                <input className="input" placeholder="Agrega una nota interna..."
                  value={datosExtraidos.nota_libre || ''}
                  onChange={e => actualizarDato('nota_libre', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Ítems */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 mb-4">
              Ítems ({datosExtraidos.items?.length || 0})
            </h3>
            <div className="space-y-3">
              {(datosExtraidos.items || []).map((item, i) => (
                <div key={i} className={`rounded-lg border p-3 ${
                  item.confianza_campo < 70 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                }`}>
                  {item.confianza_campo < 70 && (
                    <p className="text-xs text-amber-700 mb-2 font-medium">⚠️ Revisar este ítem</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="sm:col-span-2">
                      <label className="label">Descripción</label>
                      <input className="input" value={item.descripcion || ''}
                        onChange={e => actualizarItem(i, 'descripcion', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Cantidad</label>
                      <input type="number" className="input" value={item.cantidad || ''}
                        onChange={e => actualizarItem(i, 'cantidad', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Unidad</label>
                      <input className="input" value={item.unidad || ''}
                        onChange={e => actualizarItem(i, 'unidad', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">P. Unit sin IGV (S/)</label>
                      <input type="number" step="0.0001" className="input"
                        value={item.precio_unit_sin_igv || ''}
                        onChange={e => actualizarItem(i, 'precio_unit_sin_igv', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">P. Unit con IGV (S/)</label>
                      <input type="number" step="0.0001" className="input"
                        value={item.precio_unit_con_igv || ''}
                        onChange={e => actualizarItem(i, 'precio_unit_con_igv', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Subtotal (S/)</label>
                      <input type="number" step="0.01" className="input" value={item.subtotal || ''}
                        onChange={e => actualizarItem(i, 'subtotal', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Categoría</label>
                      <select className="input" value={item.categoria_id || ''}
                        onChange={e => actualizarItem(i, 'categoria_id', e.target.value ? parseInt(e.target.value) : null)}>
                        <option value="">Sin categoría</option>
                        {categorias.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setPaso(0)} className="btn-secondary flex-1">← Volver</button>
            <button onClick={() => setPaso(2)} className="btn-primary flex-1">Continuar →</button>
          </div>
        </div>
      )}

      {/* ── PASO 2: ASIGNAR PROYECTO ─────────────────── */}
      {paso === 2 && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">Asignar a proyecto</h3>
          <p className="text-sm text-gray-500">
            Puedes dividir la factura entre varios proyectos usando porcentaje o monto fijo.
          </p>

          {asignaciones.map((asig, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Asignación {i + 1}</span>
                {asignaciones.length > 1 && (
                  <button onClick={() => eliminarAsignacion(i)}
                    className="text-xs text-red-500 hover:text-red-700">✕ Quitar</button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">Proyecto</label>
                  <select className="input" value={asig.proyecto_id}
                    onChange={e => actualizarAsignacion(i, 'proyecto_id', e.target.value)}>
                    <option value="">Seleccionar proyecto...</option>
                    {proyectos.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Porcentaje (%)</label>
                  <input type="number" min="0" max="100" className="input"
                    placeholder="ej: 50"
                    value={asig.porcentaje}
                    onChange={e => actualizarAsignacion(i, 'porcentaje', e.target.value)} />
                </div>
                <div>
                  <label className="label">O monto fijo (S/)</label>
                  <input type="number" step="0.01" className="input"
                    placeholder="ej: 1500.00"
                    value={asig.monto}
                    onChange={e => actualizarAsignacion(i, 'monto', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Nota de asignación</label>
                  <input className="input" placeholder="Opcional..."
                    value={asig.nota}
                    onChange={e => actualizarAsignacion(i, 'nota', e.target.value)} />
                </div>
              </div>
            </div>
          ))}

          <button onClick={agregarAsignacion} className="btn-secondary w-full">
            + Agregar otro proyecto
          </button>

          <div className="flex gap-3">
            <button onClick={() => setPaso(1)} className="btn-secondary flex-1">← Volver</button>
            <button onClick={() => setPaso(3)} className="btn-primary flex-1">Continuar →</button>
          </div>
        </div>
      )}

      {/* ── PASO 3: CONFIRMAR ───────────────────────── */}
      {paso === 3 && datosExtraidos && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Resumen antes de guardar</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Proveedor</span>
                <span className="font-medium text-right">{datosExtraidos.proveedor?.razon_social}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">N° Factura</span>
                <span className="font-medium">{datosExtraidos.numero_factura}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Fecha</span>
                <span className="font-medium">{datosExtraidos.fecha_emision}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Ítems</span>
                <span className="font-medium">{datosExtraidos.items?.length || 0} líneas</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">IGV</span>
                <span className="font-medium">S/ {datosExtraidos.igv?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-700 font-semibold">TOTAL</span>
                <span className="text-lg font-bold text-jbm-700">S/ {datosExtraidos.total?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Proyectos asignados</h4>
            {asignaciones.filter(a => a.proyecto_id).map((a, i) => {
              const proy = proyectos.find(p => p.id == a.proyecto_id)
              return (
                <div key={i} className="flex justify-between text-sm py-1.5">
                  <span className="text-gray-600">{proy?.nombre}</span>
                  <span className="font-medium">
                    {a.porcentaje ? `${a.porcentaje}%` : a.monto ? `S/ ${a.monto}` : '—'}
                  </span>
                </div>
              )
            })}
            {asignaciones.filter(a => a.proyecto_id).length === 0 && (
              <p className="text-sm text-gray-400 italic">Sin proyecto asignado</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setPaso(2)} className="btn-secondary flex-1">← Volver</button>
            <button onClick={guardar} disabled={cargando} className="btn-primary flex-1 py-3">
              {cargando ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Guardando...
                </>
              ) : '✅ Guardar factura'}
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 4: ÉXITO ───────────────────────────── */}
      {paso === 4 && (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">¡Factura guardada!</h3>
          <p className="text-gray-500 text-sm mb-1">
            PDF subido a OneDrive y datos guardados en la base maestra.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            ID de factura: #{guardado?.facturaId}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={reiniciar} className="btn-primary">
              ⬆️ Subir otra factura
            </button>
            <a href="/facturas" className="btn-secondary">
              Ver todas las facturas
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
