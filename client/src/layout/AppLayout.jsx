import { useState, createContext, useContext } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { can } from '../context/AuthContext'
import api from '../api'
import {
  HomeIcon, ScanIcon, BuildingIcon, ForkIcon, UserIcon,
  ClipboardIcon, ChartIcon, SettingsIcon, LockIcon,
  LogoutIcon, MenuIcon,
} from '../components/icons'

// ── Contexto del sidebar ──────────────────────────────────────────
const SidebarCtx = createContext({ open: true, toggle: () => {} })
export const useSidebar = () => useContext(SidebarCtx)

// ── Navegación ────────────────────────────────────────────────────
export const NAV_GROUPS = [
  {
    label: 'Operaciones',
    items: [
      { to: '/dashboard', label: 'Dashboard',         feature: 'dashboard', icon: HomeIcon },
      { to: '/scanner',   label: 'Scanner',           feature: 'scanner',   icon: ScanIcon },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/clients',   label: 'Clientes',          feature: 'clientes',  icon: BuildingIcon },
      { to: '/services',  label: 'Servicios',         feature: 'servicios', icon: ForkIcon },
      { to: '/employees', label: 'Empleados',         feature: 'empleados', icon: UserIcon },
    ],
  },
  {
    label: 'Reportes',
    items: [
      { to: '/purchases', label: 'Historial',         feature: 'historial', icon: ClipboardIcon },
      { to: '/reports',   label: 'Reportes',          feature: 'reportes',  icon: ChartIcon },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/config',    label: 'Métodos de Cobro',  feature: 'config',    icon: SettingsIcon },
      { to: '/users',     label: 'Usuarios',          feature: 'usuarios',  icon: LockIcon },
    ],
  },
]

const ROLE_BADGE = {
  super_admin:   { label: 'Super Admin', cls: 'bg-primary/20 text-primary' },
  admin_empresa: { label: 'Admin',       cls: 'bg-primary/20 text-primary' },
  scanner:       { label: 'Scanner',     cls: 'bg-green-500/20 text-green-400' },
}

// ── Modal cambiar contraseña ──────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [form, setForm]   = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [ok, setOk]       = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')
    if (!form.current || !form.next || !form.confirm)
      return setError('Todos los campos son requeridos')
    if (form.next.length < 8)
      return setError('La nueva contraseña debe tener al menos 8 caracteres')
    if (form.next !== form.confirm)
      return setError('Las contraseñas nuevas no coinciden')
    setSaving(true)
    try {
      await api.put('/auth/change-password', {
        current_password: form.current,
        new_password: form.next,
      })
      setOk(true)
    } catch (e) {
      setError(e.response?.data?.error || 'Error al cambiar contraseña')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Cambiar contraseña</h2>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            ✕
          </button>
        </div>

        {ok ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-800">Contraseña actualizada</p>
            <p className="text-sm text-gray-500 mt-1">Usa la nueva contraseña en tu próximo inicio de sesión.</p>
            <button onClick={onClose}
              className="mt-5 w-full py-2 bg-primary text-white rounded-lg text-sm font-medium">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Contraseña actual</label>
              <input type="password" value={form.current}
                onChange={e => setForm({ ...form, current: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                placeholder="••••••••"/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nueva contraseña</label>
              <input type="password" value={form.next}
                onChange={e => setForm({ ...form, next: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                placeholder="Mínimo 4 caracteres"/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Confirmar nueva contraseña</label>
              <input type="password" value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                placeholder="••••••••"/>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button onClick={submit} disabled={saving}
              className="mt-1 w-full py-2.5 bg-primary hover:bg-primary-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tooltip de navegación (modo colapsado) ────────────────────────
function NavTooltip({ label, children }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5
        bg-navy-800 text-white text-xs font-medium rounded-lg whitespace-nowrap
        opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50
        shadow-lg border border-white/10">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-navy-800"/>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────
function Sidebar() {
  const { session, logout } = useAuth()
  const { open } = useContext(SidebarCtx)
  const badge    = ROLE_BADGE[session?.role] || {}
  const initials = (session?.username || session?.client_name || '?').slice(0, 2).toUpperCase()
  const [changePwd, setChangePwd] = useState(false)

  return (
    <aside className={`
      bg-navy-900 text-white flex flex-col shrink-0 h-screen sticky top-0
      transition-all duration-300 ease-in-out overflow-hidden
      ${open ? 'w-60' : 'w-[68px]'}
    `}>
      {/* Logo */}
      <div className={`flex items-center border-b border-white/10 shrink-0
        ${open ? 'px-5 py-4 gap-3' : 'px-0 py-4 justify-center'}`}>
        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
          <span className="text-white font-black text-[11px] tracking-tight">CMS</span>
        </div>
        {open && (
          <div>
            <div className="text-white font-bold text-sm leading-none">CafeteriaMS</div>
            <div className="text-white/30 text-[10px] mt-0.5">Meal Management System</div>
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 ${open ? 'px-3' : 'px-2'}`}>
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(i => can(session, i.feature))
          if (!visibleItems.length) return null
          return (
            <div key={group.label}>
              {open && (
                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest px-2 mb-1 whitespace-nowrap">
                  {group.label}
                </p>
              )}
              {!open && <div className="h-px bg-white/10 mx-1 mb-1"/>}
              <div className="space-y-0.5">
                {visibleItems.map(item =>
                  open ? (
                    <NavLink key={item.to} to={item.to}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${isActive
                          ? 'bg-primary text-white shadow-sm shadow-primary/30'
                          : 'text-white/60 hover:text-white hover:bg-white/10'}
                      `}>
                      <item.icon />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </NavLink>
                  ) : (
                    <NavTooltip key={item.to} label={item.label}>
                      <NavLink to={item.to}
                        className={({ isActive }) => `
                          flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all
                          ${isActive
                            ? 'bg-primary text-white shadow-sm shadow-primary/30'
                            : 'text-white/50 hover:text-white hover:bg-white/10'}
                        `}>
                        <item.icon />
                      </NavLink>
                    </NavTooltip>
                  )
                )}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Usuario */}
      <div className={`border-t border-white/10 shrink-0 ${open ? 'px-3 py-3' : 'px-2 py-3'}`}>
        {open ? (
          <>
            <div className="flex items-center gap-2.5 px-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs font-semibold truncate">
                  {session?.username || session?.client_name}
                </div>
                {session?.client_name && session?.role !== 'scanner' && (
                  <div className="text-white/40 text-[11px] truncate">{session.client_name}</div>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
            </div>
            <button onClick={() => setChangePwd(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors text-xs font-medium">
              🔑 Cambiar contraseña
            </button>
            <button onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs font-medium">
              <LogoutIcon />
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <NavTooltip label="Cambiar contraseña">
              <button onClick={() => setChangePwd(true)}
                className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors text-base">
                🔑
              </button>
            </NavTooltip>
            <NavTooltip label="Cerrar sesión">
              <button onClick={logout}
                className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <LogoutIcon />
              </button>
            </NavTooltip>
          </>
        )}
      </div>

      {changePwd && <ChangePasswordModal onClose={() => setChangePwd(false)} />}
    </aside>
  )
}

// ── Topbar ────────────────────────────────────────────────────────
function Topbar() {
  const location = useLocation()
  const { open, toggle } = useContext(SidebarCtx)
  const allItems  = NAV_GROUPS.flatMap(g => g.items)
  const current   = allItems.find(i => location.pathname.startsWith(i.to))

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 shrink-0">
      <button onClick={toggle}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-navy-900 hover:bg-gray-100 transition-colors shrink-0">
        <MenuIcon />
      </button>
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-xs font-bold text-gray-400">CMS</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-semibold">{current?.label || ''}</span>
      </div>
    </header>
  )
}

// ── Layout principal ──────────────────────────────────────────────
export default function AppLayout({ children }) {
  const [open, setOpen] = useState(true)

  return (
    <SidebarCtx.Provider value={{ open, toggle: () => setOpen(o => !o) }}>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarCtx.Provider>
  )
}
