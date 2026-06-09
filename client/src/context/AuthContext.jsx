import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const SESSION_KEY = 'cafeteria_ms_session'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const login = (data) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data))
    setSession(data)
  }

  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

// Permisos por rol
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_EMPRESA: 'admin_empresa',
  SCANNER: 'scanner',
}

export function can(session, feature) {
  if (!session) return false
  const { role } = session
  const perms = {
    super_admin:   ['dashboard','scanner','clientes','servicios','empleados','historial','reportes','config','usuarios'],
    admin_empresa: ['dashboard','scanner','servicios','empleados','historial','reportes','config'],
    scanner:       ['scanner'],
  }
  return perms[role]?.includes(feature) ?? false
}
