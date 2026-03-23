import { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const saved = localStorage.getItem('jbm_usuario')
    return saved ? JSON.parse(saved) : null
  })
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('jbm_token')
    if (token) {
      authService.me()
        .then(res => setUsuario(res.data))
        .catch(() => { logout() })
        .finally(() => setCargando(false))
    } else {
      setCargando(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await authService.login(email, password)
    const { access_token, usuario: user } = res.data
    localStorage.setItem('jbm_token', access_token)
    localStorage.setItem('jbm_usuario', JSON.stringify(user))
    setUsuario(user)
    return user
  }

  const logout = () => {
    localStorage.removeItem('jbm_token')
    localStorage.removeItem('jbm_usuario')
    setUsuario(null)
  }

  const esAdmin   = usuario?.rol === 'administrador'
  const esGerencia = usuario?.rol === 'gerencia'

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando, esAdmin, esGerencia }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
