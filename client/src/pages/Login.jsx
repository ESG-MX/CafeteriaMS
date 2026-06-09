import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

// ── Paso 1: Selección de empresa ──────────────────────────────────
function StepSelectCompany({ onSelect }) {
  const [clients, setClients] = useState([])

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data))
  }, [])

  return (
    <div className="w-full">
      <p className="text-slate-400 text-xs uppercase tracking-widest text-center mb-5 font-semibold">
        Selecciona tu empresa
      </p>

      {clients.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-8 border border-slate-700 rounded-2xl">
          No hay empresas activas registradas
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="group flex items-center gap-4 bg-slate-800/60 hover:bg-slate-700/60
                border border-slate-700 hover:border-primary/50
                rounded-xl px-5 py-3.5 text-left transition-all duration-200
                hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M8 12h8M8 16h8"/>
                </svg>
              </div>
              <span className="text-white font-medium text-sm flex-1">{c.name}</span>
              <svg className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Paso 2: Credenciales ──────────────────────────────────────────
function StepCredentials({ company, onSuccess, onBack }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) return setError('Completa todos los campos')
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', { username, password, client_id: company.id })
      onSuccess(data)
    } catch (e) {
      setError(e.response?.data?.error || 'Usuario o contraseña incorrectos')
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Empresa elegida */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium mb-6 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
        Cambiar empresa
      </button>

      <div className="flex items-center gap-3 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3 mb-6">
        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M8 12h8M8 16h8"/>
          </svg>
        </div>
        <div>
          <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Empresa</div>
          <div className="text-white font-semibold text-sm">{company.name}</div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-slate-400 text-xs font-semibold block mb-1.5 uppercase tracking-wider">Usuario</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Ingresa tu usuario"
            autoComplete="username"
            autoFocus
            className="w-full bg-slate-800/60 border border-slate-700 focus:border-primary/60
              rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs font-semibold block mb-1.5 uppercase tracking-wider">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full bg-slate-800/60 border border-slate-700 focus:border-primary/60
              rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500
              focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {error && (
          <div className="text-danger-500 text-xs bg-danger-500/10 border border-danger-500/30 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-600 text-white font-semibold py-2.5 rounded-xl text-sm
            transition-colors disabled:opacity-50 shadow-lg shadow-primary/20 mt-1"
        >
          {loading ? 'Verificando...' : 'Iniciar sesión →'}
        </button>
      </div>
    </form>
  )
}

// ── Login principal ───────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth()
  const [step, setStep]                       = useState('company')
  const [selectedCompany, setSelectedCompany] = useState(null)

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4 relative overflow-hidden">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl"/>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-primary/6 blur-3xl"/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-navy-800/40 blur-2xl"/>
      </div>

      {/* Card central */}
      <div className="relative w-full max-w-4xl flex rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-slate-700/50">

        {/* Panel izquierdo — info */}
        <div className="hidden lg:flex w-2/5 bg-navy-800/80 backdrop-blur-sm flex-col justify-between p-10">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="text-white font-black text-xs tracking-tight">CMS</span>
              </div>
              <div>
                <div className="text-white font-bold text-base leading-none">CafeteriaMS</div>
                <div className="text-slate-500 text-[11px] mt-0.5">Meal Management System</div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-5">
              {[
                ['Control de acceso',       'RFID, número de empleado o huella biométrica'],
                ['Límites por empleado',    'Cuotas diarias y semanales configurables'],
                ['Reportes en tiempo real', 'Dashboard en vivo y exportación a Excel'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 shrink-0">
                    <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{t}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stack badge */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['React 19', 'Node.js', 'SQLite', 'WebSocket', 'ExcelJS'].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg bg-slate-700/60 text-slate-400 text-[11px] font-medium border border-slate-600/40">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Panel derecho — formulario */}
        <div className="flex-1 bg-slate-900/90 backdrop-blur-sm flex flex-col justify-center px-10 py-12">

          {/* Header mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-xs">CMS</span>
            </div>
            <div>
              <div className="text-white font-bold text-sm">CafeteriaMS</div>
              <div className="text-slate-500 text-[10px]">Meal Management System</div>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mb-8">
            {['Empresa', 'Acceso'].map((s, i) => {
              const active = (i === 0 && step === 'company') || (i === 1 && step === 'credentials')
              const done   = i === 0 && step === 'credentials'
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-px bg-slate-700"/>}
                  <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors
                    ${active ? 'text-white' : done ? 'text-primary' : 'text-slate-600'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                      ${active ? 'bg-primary text-white' : done ? 'bg-primary/20 text-primary' : 'border border-slate-700 text-slate-600'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    {s}
                  </div>
                </div>
              )
            })}
          </div>

          {step === 'company' && <StepSelectCompany onSelect={c => { setSelectedCompany(c); setStep('credentials') }} />}
          {step === 'credentials' && (
            <StepCredentials
              company={selectedCompany}
              onSuccess={data => login(data)}
              onBack={() => setStep('company')}
            />
          )}
        </div>
      </div>
    </div>
  )
}
