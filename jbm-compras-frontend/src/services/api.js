import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: API_URL })

// Adjuntar token JWT automáticamente en cada request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('jbm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token venció, redirigir al login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('jbm_token')
      localStorage.removeItem('jbm_usuario')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── AUTH ────────────────────────────────────────────────
export const authService = {
  login: (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return api.post('/api/auth/login', form)
  },
  me: () => api.get('/api/auth/me'),
  crearUsuario: (data) => api.post('/api/auth/usuarios', data),
  listarUsuarios: () => api.get('/api/auth/usuarios'),
}

// ── FACTURAS ────────────────────────────────────────────
export const facturasService = {
  extraer: (archivo) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return api.post('/api/facturas/extraer', form)
  },
  guardar: (datos) => api.post('/api/facturas/guardar', datos),
  subirPdf: (facturaId, archivo) => {
    const form = new FormData()
    form.append('archivo', archivo)
    return api.post(`/api/facturas/subir-pdf/${facturaId}`, form)
  },
  listar: (params) => api.get('/api/facturas/', { params }),
  obtener: (id) => api.get(`/api/facturas/${id}`),
}

// ── PROYECTOS ───────────────────────────────────────────
export const proyectosService = {
  listar: () => api.get('/api/proyectos/'),
  crear: (data) => api.post('/api/proyectos/', data),
  actualizar: (id, data) => api.patch(`/api/proyectos/${id}`, data),
}

// ── PROVEEDORES ─────────────────────────────────────────
export const proveedoresService = {
  listar: () => api.get('/api/proveedores/'),
  buscarRuc: (ruc) => api.get('/api/proveedores/buscar', { params: { ruc } }),
}

// ── CATÁLOGO ────────────────────────────────────────────
export const catalogoService = {
  categorias: () => api.get('/api/catalogo/categorias'),
  materiales: (params) => api.get('/api/catalogo/materiales', { params }),
  crearMaterial: (data) => api.post('/api/catalogo/materiales', data),
  historialPrecios: (id) => api.get(`/api/catalogo/materiales/${id}/historial`),
}

// ── REPORTES ────────────────────────────────────────────
export const reportesService = {
  gastosPorMes: (anio, proyectoId) =>
    api.get('/api/reportes/gastos-por-mes', { params: { anio, proyecto_id: proyectoId } }),
  gastosPorProyecto: (desde, hasta) =>
    api.get('/api/reportes/gastos-por-proyecto', { params: { desde, hasta } }),
  rankingProveedores: (desde, hasta) =>
    api.get('/api/reportes/ranking-proveedores', { params: { desde, hasta } }),
  dashboard: () => api.get('/api/reportes/resumen-dashboard'),
}

export default api
