import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import Toggle from '../components/Toggle'

const METHOD_INFO = {
  rfid:            { icon: '📡', label: 'RFID / Tarjeta',     desc: 'El empleado pasa su tarjeta o llavero por el lector.' },
  employee_number: { icon: '🔢', label: 'Número de Empleado', desc: 'El empleado ingresa su número de empleado manualmente.' },
  biometric:       { icon: '👆', label: 'Biométrico',         desc: 'El empleado pasa su huella por el lector biométrico.' },
}

function CompanyMethods({ clientId, clientName }) {
  const [methods, setMethods] = useState([])
  const [saving, setSaving] = useState(null)

  const load = () =>
    api.get(`/clients/${clientId}/scan-methods`).then(r => setMethods(r.data))

  useEffect(() => { if (clientId) load() }, [clientId])

  const toggle = async (method, newVal) => {
    setSaving(method)
    try {
      await api.put(`/clients/${clientId}/scan-methods/${method}`, { enabled: newVal })
      setMethods(m => m.map(x => x.key === method ? { ...x, enabled: newVal ? 1 : 0 } : x))
    } catch (e) { alert(e.response?.data?.error || 'Error') }
    finally { setSaving(null) }
  }

  if (!clientId) return (
    <div className="text-center text-gray-400 py-12">Selecciona una empresa para configurar</div>
  )

  return (
    <div>
      {clientName && <h2 className="text-lg font-semibold text-gray-700 mb-4">🏢 {clientName}</h2>}
      <div className="flex flex-col gap-3">
        {methods.map(m => {
          const info = METHOD_INFO[m.key] || {}
          return (
            <div key={m.key}
              className={`flex items-center gap-4 bg-white rounded-xl shadow-sm border-2 p-5 transition-all
                ${m.enabled ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100'}`}>
              <div className={`text-4xl w-14 h-14 flex items-center justify-center rounded-xl
                ${m.enabled ? 'bg-primary-100' : 'bg-gray-100'}`}>
                {info.icon}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800">{info.label}</div>
                <div className="text-sm text-gray-500 mt-0.5">{info.desc}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium ${m.enabled ? 'text-primary' : 'text-gray-400'}`}>
                  {saving === m.key ? '...' : m.enabled ? 'Habilitado' : 'Deshabilitado'}
                </span>
                <Toggle
                  enabled={!!m.enabled}
                  onChange={val => toggle(m.key, val)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TIMEZONES = [
  { offset: -12, label: 'UTC-12' },
  { offset: -11, label: 'UTC-11' },
  { offset: -10, label: 'UTC-10 — Hawái' },
  { offset:  -9, label: 'UTC-9  — Alaska' },
  { offset:  -8, label: 'UTC-8  — Baja California (Tijuana)' },
  { offset:  -7, label: 'UTC-7  — Sonora / Chihuahua' },
  { offset:  -6, label: 'UTC-6  — Centro México (CDMX, GDL, MTY)' },
  { offset:  -5, label: 'UTC-5  — Quintana Roo (Cancún) / Colombia' },
  { offset:  -4, label: 'UTC-4  — Venezuela / Bolivia' },
  { offset:  -3, label: 'UTC-3  — Argentina / Brasil (Brasilia)' },
  { offset:  -2, label: 'UTC-2' },
  { offset:  -1, label: 'UTC-1' },
  { offset:   0, label: 'UTC+0  — Londres' },
  { offset:  +1, label: 'UTC+1  — Madrid / París' },
  { offset:  +2, label: 'UTC+2  — Berlín / Cairo' },
]

// ── Zona horaria (guardada en DB por empresa) ─────────────────────
function TimezoneSettings({ clientId }) {
  const [offset, setOffset]   = useState(null)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!clientId) return
    api.get(`/clients/${clientId}`).then(r => {
      setOffset(r.data.timezone_offset ?? -6)
    })
  }, [clientId])

  const save = async (val) => {
    setSaving(true)
    try {
      await api.put(`/clients/${clientId}/settings`, { timezone_offset: Number(val) })
      setOffset(Number(val))
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar') }
    finally { setSaving(false) }
  }

  if (offset === null) return null

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Zona horaria</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Define la hora local para detectar el servicio activo al escanear.
        </p>
      </div>

      <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border-2 border-gray-100 p-5">
        <div className="text-4xl w-14 h-14 flex items-center justify-center rounded-xl bg-gray-100 shrink-0">
          🕐
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-800 mb-1">Zona horaria de la empresa</div>
          <select
            value={offset}
            onChange={e => save(e.target.value)}
            disabled={saving}
            className="w-full border rounded px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.offset} value={tz.offset}>{tz.label}</option>
            ))}
          </select>
        </div>
        {saving && <span className="text-xs text-gray-400 shrink-0">Guardando...</span>}
      </div>
    </div>
  )
}

// ── Impresión silenciosa (guardado en DB por empresa) ─────────────
function PrintSettings({ clientId }) {
  const [silent, setSilent]   = useState(null)  // null = cargando
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!clientId) return
    api.get(`/clients/${clientId}`).then(r => {
      setSilent(r.data.silent_print !== 0)
    })
  }, [clientId])

  const toggle = async (val) => {
    setSaving(true)
    try {
      await api.put(`/clients/${clientId}/settings`, { silent_print: val ? 1 : 0 })
      setSilent(val)
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar') }
    finally { setSaving(false) }
  }

  if (silent === null) return null

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Impresión</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Aplica a todas las terminales de esta empresa de forma inmediata.
        </p>
      </div>

      <div className={`flex items-center gap-4 bg-white rounded-xl shadow-sm border-2 p-5 transition-all
        ${silent ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100'}`}>
        <div className={`text-4xl w-14 h-14 flex items-center justify-center rounded-xl shrink-0
          ${silent ? 'bg-primary-100' : 'bg-gray-100'}`}>
          🖨️
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-800">Impresión Rápida</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {silent
              ? 'Imprime directo sin diálogo. Requiere QZ Tray instalado en cada terminal.'
              : 'Muestra el diálogo del navegador antes de imprimir.'}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-medium ${saving ? 'text-gray-400' : silent ? 'text-primary' : 'text-gray-400'}`}>
            {saving ? '...' : silent ? 'Activada' : 'Desactivada'}
          </span>
          <Toggle enabled={!!silent} onChange={toggle} />
        </div>
      </div>
    </div>
  )
}

export default function Config() {
  const { session } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedName, setSelectedName] = useState('')

  useEffect(() => {
    if (session.role === 'super_admin') {
      api.get('/clients').then(r => {
        const active = r.data.filter(c => c.active)
        setClients(active)
        if (active.length) { setSelectedId(active[0].id); setSelectedName(active[0].name) }
      })
    } else {
      setSelectedId(session.client_id)
      setSelectedName(session.client_name)
    }
  }, [])

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Métodos de cobro y límites de servicio por empresa.</p>
      </div>

      {/* Selector de empresa (solo super_admin) */}
      {session.role === 'super_admin' && clients.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {clients.map(c => (
            <button key={c.id}
              onClick={() => { setSelectedId(c.id); setSelectedName(c.name) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                ${selectedId === c.id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <>
          {session.role === 'super_admin' && selectedName && (
            <h2 className="text-lg font-semibold text-gray-700 mb-4">🏢 {selectedName}</h2>
          )}
          <CompanyMethods clientId={selectedId} clientName={null} />
          <PrintSettings clientId={selectedId} />
          <TimezoneSettings clientId={selectedId} />
        </>
      )}

    </div>
  )
}
