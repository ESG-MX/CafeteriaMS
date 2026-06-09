import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const fmt = (n) =>
  '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SERVICE_STYLE = {
  'Desayuno': { bg: 'bg-amber-50',   border: 'border-amber-200',  bar: 'bg-amber-400',  text: 'text-amber-700',  icon: '☀️' },
  'Comida':   { bg: 'bg-orange-50',  border: 'border-orange-200', bar: 'bg-[#FF9E1B]',  text: 'text-[#FF9E1B]',  icon: '🍽️' },
  'Cena':     { bg: 'bg-indigo-50',  border: 'border-indigo-200', bar: 'bg-indigo-400', text: 'text-indigo-700', icon: '🌙' },
}
const DEFAULT_SERVICE_STYLE = { bg: 'bg-gray-50', border: 'border-gray-200', bar: 'bg-gray-400', text: 'text-gray-700', icon: '🍴' }

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function getWsUrl() {
  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) return apiUrl.replace(/^http/, 'ws').replace(/\/api$/, '')
  return `${window.location.protocol.replace('http', 'ws')}//${window.location.host}`
}

export default function Dashboard() {
  const { session } = useAuth()
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [clients, setClients]         = useState([])
  const [selectedClient, setSelected] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [wsStatus, setWsStatus]       = useState('connecting')
  const [toast, setToast]             = useState(null)   // { text }

  const loadRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const params = selectedClient ? `?client_id=${selectedClient}` : ''
      const res = await api.get(`/dashboard${params}`)
      setData(res.data)
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedClient])

  // Mantener ref siempre actualizada para el WS
  useEffect(() => { loadRef.current = load }, [load])

  useEffect(() => {
    if (session.role === 'super_admin')
      api.get('/clients').then(r => setClients(r.data.filter(c => c.active)))
  }, [])

  useEffect(() => { load() }, [load])

  // Polling de respaldo cada 5 min (WS cubre el tiempo real)
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  // WebSocket — auto-reconecta cada 3s si se desconecta
  useEffect(() => {
    let ws
    let reconnTimer

    const connect = () => {
      ws = new WebSocket(getWsUrl())
      ws.onopen  = () => setWsStatus('connected')
      ws.onclose = () => {
        setWsStatus('disconnected')
        reconnTimer = setTimeout(connect, 3000)
      }
      ws.onerror = () => {}
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'purchase') {
            loadRef.current()
            setToast({ text: `${msg.data.employee_name} — ${msg.data.service_name}` })
          }
        } catch {}
      }
    }

    connect()
    return () => { clearTimeout(reconnTimer); ws?.close() }
  }, [])

  // Toast auto-dismiss después de 4s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Cargando...</div>
  )
  if (!data) return null

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const dateLabel = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const maxSvcTotal = Math.max(...data.byService.map(s => s.total), 1)

  const wsInfo = {
    connected:    { dot: 'bg-green-400', label: 'En vivo' },
    disconnected: { dot: 'bg-red-400 animate-pulse', label: 'Sin conexión' },
    connecting:   { dot: 'bg-yellow-400 animate-pulse', label: 'Conectando...' },
  }[wsStatus]

  return (
    <div>
      {/* ── Toast nueva transacción ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0C2340] text-white px-4 py-3 rounded-xl shadow-xl
          flex items-center gap-3 text-sm animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <div>
            <div className="font-semibold">Nueva transacción</div>
            <div className="text-white/70 text-xs">{toast.text}</div>
          </div>
          <button onClick={() => setToast(null)} className="ml-2 text-white/40 hover:text-white">✕</button>
        </div>
      )}

      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{greeting}, {session.username}</h1>
          <p className="text-gray-400 text-sm mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicador WebSocket */}
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm">
            <span className={`w-2 h-2 rounded-full ${wsInfo.dot}`} />
            <span className="text-xs text-gray-500">{wsInfo.label}</span>
          </div>

          {session.role === 'super_admin' && clients.length > 1 && (
            <select value={selectedClient} onChange={e => setSelected(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 bg-white shadow-sm">
              <option value="">Todas las empresas</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button onClick={load}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm transition-colors">
            ↻ Actualizar
            {lastRefresh && (
              <span className="text-gray-300">
                · {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Cobros hoy"
          value={data.today.count}
          sub="transacciones aprobadas"
          accent="text-[#FF9E1B]"
        />
        <KpiCard
          label="Monto hoy"
          value={fmt(data.today.total)}
          sub="total del día"
          accent="text-[#0C2340]"
        />
        <KpiCard
          label="Cobros semana"
          value={data.week.count}
          sub="semana actual (lun–dom)"
          accent="text-blue-600"
        />
        <KpiCard
          label="Monto del mes"
          value={fmt(data.month.total)}
          sub="mes en curso"
          accent="text-green-600"
        />
      </div>

      {/* ── Servicios + Reciente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Servicios hoy */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Servicios hoy</h2>
          {data.byService.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <span className="text-4xl mb-2">🍽️</span>
              <span className="text-sm">Sin cobros registrados hoy</span>
            </div>
          ) : (
            <div className="space-y-3">
              {data.byService.map(s => {
                const st  = SERVICE_STYLE[s.service_name] || DEFAULT_SERVICE_STYLE
                const pct = Math.round((s.total / maxSvcTotal) * 100)
                return (
                  <div key={s.service_name}
                    className={`${st.bg} ${st.border} border rounded-xl p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{st.icon}</span>
                        <span className={`font-semibold text-sm ${st.text}`}>{s.service_name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-gray-800 text-sm">{fmt(s.total)}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.count} cobros</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                      <div className={`h-full ${st.bar} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Actividad reciente</h2>
          {data.recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <span className="text-4xl mb-2">📋</span>
              <span className="text-sm">Sin actividad reciente</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recent.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FF9E1B]/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#FF9E1B]">
                      {(r.employee_name || '?').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{r.employee_name}</div>
                    <div className="text-xs text-gray-400 truncate">{r.service_name} · {r.client_name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-gray-700">{fmt(r.price)}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Por empresa (super_admin sin filtro) ── */}
      {data.byClient.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Por empresa hoy</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.byClient.map(c => (
              <div key={c.client_name}
                className="border border-gray-100 rounded-xl p-4 text-center hover:border-[#FF9E1B]/40 transition-colors">
                <div className="text-sm font-semibold text-gray-700 mb-1 truncate">{c.client_name}</div>
                <div className="text-xl font-bold text-[#FF9E1B]">{fmt(c.total)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.count} cobros</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
