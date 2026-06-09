import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth, can } from './context/AuthContext'
import AppLayout, { NAV_GROUPS } from './layout/AppLayout'

import Login       from './pages/Login'
import Dashboard   from './pages/Dashboard'
import Clients     from './pages/Clients'
import Services    from './pages/Services'
import Employees   from './pages/Employees'
import RFIDScanner from './pages/RFIDScanner'
import Purchases   from './pages/Purchases'
import Reports     from './pages/Reports'
import Config      from './pages/Config'
import Users       from './pages/Users'

function AppRoutes() {
  const { session } = useAuth()

  if (!session) return <Login />

  const allItems = NAV_GROUPS.flatMap(g => g.items)
  const first    = allItems.find(i => can(session, i.feature))?.to || '/scanner'

  const guard = (feature, element) =>
    can(session, feature) ? element : <Navigate to={first} replace />

  return (
    <AppLayout>
      <Routes>
        <Route path="/"          element={<Navigate to={first} replace />} />
        <Route path="/dashboard" element={guard('dashboard', <Dashboard />)} />
        <Route path="/scanner"   element={guard('scanner',   <RFIDScanner />)} />
        <Route path="/clients"   element={guard('clientes',  <Clients />)} />
        <Route path="/services"  element={guard('servicios', <Services />)} />
        <Route path="/employees" element={guard('empleados', <Employees />)} />
        <Route path="/purchases" element={guard('historial', <Purchases />)} />
        <Route path="/reports"   element={guard('reportes',  <Reports />)} />
        <Route path="/config"    element={guard('config',    <Config />)} />
        <Route path="/users"     element={guard('usuarios',  <Users />)} />
        <Route path="*"          element={<Navigate to={first} replace />} />
      </Routes>
    </AppLayout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
