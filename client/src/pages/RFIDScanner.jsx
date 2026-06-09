import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { printTicket, connect as qzConnect, onQZStatusChange } from '../utils/printer'

// Formatea fecha para el ticket: "04/Jun/2026  13:22"
function fmtTicketDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const dd   = String(d.getDate()).padStart(2, '0')
  const mon  = months[d.getMonth()]
  const yyyy = d.getFullYear()
  const hh   = String(d.getHours()).padStart(2, '0')
  const mm   = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mon}/${yyyy}  ${hh}:${mm}`
}

const METHOD_META = {
  rfid:            { icon: '📡', label: 'RFID / Tarjeta',     placeholder: 'Pasa la tarjeta por el lector...',      inputLabel: 'Código RFID' },
  employee_number: { icon: '🔢', label: 'Núm. Empleado',      placeholder: 'Escribe el número de empleado...',       inputLabel: 'Número de empleado' },
  biometric:       { icon: '👆', label: 'Biométrico',         placeholder: 'Pasa el dedo por el lector...',          inputLabel: 'ID Biométrico' },
}

export default function RFIDScanner() {
  const { session } = useAuth()
  const [methods, setMethods]         = useState([])
  const [activeMethod, setActive]     = useState(null)
  const [identifier, setIdentifier]   = useState('')
  const [result, setResult]           = useState(null)
  const [loading, setLoading]         = useState(false)
  const [silentPrint, setSilentPrint] = useState(true)
  // 'checking' | 'connected' | 'unavailable' | 'print-error' | 'fallback' | 'printed'
  const [qzStatus, setQzStatus]       = useState('checking')
  const [qzDetail, setQzDetail]       = useState('')
  const [showTicket, setShowTicket]   = useState(false)
  const inputRef = useRef(null)

  // Suscribirse al estado de QZ Tray para mostrarlo en el badge
  useEffect(() => {
    const unsub = onQZStatusChange((status, detail) => {
      setQzStatus(status)
      setQzDetail(detail || '')
    })
    // Intentar conectar proactivamente al cargar el scanner
    qzConnect()
    return unsub
  }, [])

  // Cargar métodos habilitados + configuración silent_print
  useEffect(() => {
    if (!session?.client_id) return
    api.get(`/clients/${session.client_id}/scan-methods`).then(r => {
      const enabled = r.data.filter(m => m.enabled)
      setMethods(enabled)
      if (enabled.length) setActive(enabled[0].key)
    })
    api.get(`/clients/${session.client_id}`).then(r => {
      setSilentPrint(r.data.silent_print !== 0)
    })
  }, [session?.client_id])

  useEffect(() => {
    setIdentifier('')
    setResult(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [activeMethod])

  const handleScan = async (e) => {
    e.preventDefault()
    if (!identifier.trim() || !activeMethod) return
    setLoading(true)
    setResult(null)
    try {
      const { data } = await api.post('/rfid/scan', {
        identifier: identifier.trim(),
        method: activeMethod,
        client_id: session.client_id,
      })
      setResult(data)
    } catch {
      setResult({ status: 'error', reason: 'Error de conexión con el servidor' })
    } finally {
      setLoading(false)
      setIdentifier('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // Logo monocromático listo para térmica — no requiere conversión canvas
  const logoDataUrl = `${window.location.origin}/logo-thermal.png`

  const _ticketData = () => ({
    clientName:     session?.client_name,
    employeeName:   result?.employee_name,
    employeeNumber: result?.employee_number,
    serviceName:    result?.service_name,
    price:          result?.price,
    timestamp:      result?.timestamp,
    purchaseId:     result?.purchase_id,
    logoUrl:        logoDataUrl,   // base64 B&W para térmica
  })

  // Auto-imprimir cuando se aprueba un cobro
  useEffect(() => {
    if (result?.status === 'approved') {
      setTimeout(() => printTicket(_ticketData(), { silent: silentPrint }), 400)
    }
  }, [result])

  const handleReprint = useCallback(() => {
    if (!result) return
    printTicket(_ticketData(), { silent: silentPrint })
  }, [result, session, silentPrint])

  const meta = METHOD_META[activeMethod] || {}

  // Badge visual para estado QZ Tray
  const QZ_BADGE = {
    checking:    { color: 'bg-gray-100 text-gray-500 border-gray-300',      icon: '⏳', label: 'QZ Tray: verificando...' },
    connected:   { color: 'bg-green-50 text-green-700 border-green-300',    icon: '🖨️', label: `QZ Tray conectado` },
    printed:     { color: 'bg-green-50 text-green-700 border-green-300',    icon: '✅', label: 'Ticket impreso (QZ)' },
    unavailable: { color: 'bg-amber-50 text-amber-700 border-amber-300',    icon: '⚠️', label: 'QZ Tray no disponible — usando diálogo' },
    'print-error':{ color: 'bg-red-50 text-red-700 border-red-300',         icon: '❌', label: 'Error QZ Tray — usando diálogo' },
    fallback:    { color: 'bg-amber-50 text-amber-700 border-amber-300',    icon: '🖥️', label: 'Imprimiendo con diálogo del navegador' },
    disconnected:{ color: 'bg-gray-100 text-gray-500 border-gray-300',      icon: '○',  label: 'QZ Tray desconectado' },
  }
  const badge = QZ_BADGE[qzStatus] ?? QZ_BADGE.checking

  return (
    <div className="max-w-lg mx-auto mt-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Scanner</h1>
            {session?.client_name && (
              <p className="text-primary font-medium mt-0.5 text-sm">🏢 {session.client_name}</p>
            )}
          </div>
          {/* Badge estado impresión */}
          <div
            title={qzDetail || badge.label}
            className={`mt-1 flex items-center gap-1.5 text-xs border rounded-full px-2.5 py-1 cursor-default select-none whitespace-nowrap ${badge.color}`}
          >
            <span>{badge.icon}</span>
            <span className="hidden sm:inline">{badge.label}</span>
          </div>
        </div>
      </div>

      {/* Sin métodos habilitados */}
      {methods.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-700">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="font-medium">No hay métodos de cobro habilitados</p>
          <p className="text-sm mt-1">Un administrador debe habilitar al menos un método en Configuración.</p>
        </div>
      )}

      {/* Tabs de método */}
      {methods.length > 0 && (
        <>
          <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
            {methods.map(m => {
              const info = METHOD_META[m.key] || {}
              return (
                <button
                  key={m.key}
                  onClick={() => setActive(m.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                    ${activeMethod === m.key
                      ? 'bg-white text-primary-500 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <span>{info.icon}</span>
                  <span className="hidden sm:inline">{info.label}</span>
                </button>
              )
            })}
          </div>

          {/* Formulario */}
          <form onSubmit={handleScan} className="bg-white rounded-xl shadow p-6 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {meta.icon} {meta.inputLabel}
              </label>
              <input
                ref={inputRef}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder={meta.placeholder}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition
                  ${loading ? 'bg-gray-50 text-gray-400' : 'focus:ring-primary'}`}
                autoComplete="off"
                disabled={loading}
              />

              {/* Hint solo para número de empleado */}
              {activeMethod === 'employee_number' && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-500 font-mono text-xs">Enter</kbd>
                  El servicio se asigna automáticamente según el horario actual
                </p>
              )}
            </div>

            {/* Botón solo para RFID y biométrico (el lector lo activa por Enter de todas formas) */}
            {activeMethod !== 'employee_number' && (
              <button type="submit" disabled={loading || !identifier.trim()}
                className="bg-primary hover:bg-primary-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-40">
                {loading ? 'Procesando...' : 'Registrar cobro'}
              </button>
            )}

            {/* Estado de carga para número de empleado */}
            {activeMethod === 'employee_number' && loading && (
              <div className="flex items-center justify-center gap-2 py-2 text-primary text-sm">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Procesando cobro...
              </div>
            )}
          </form>

          {/* Resultado en pantalla */}
          {result && (
            <div className={`mt-5 rounded-xl p-6 text-center shadow-sm transition-all
              ${result.status === 'approved'
                ? 'bg-green-50 border-2 border-green-400'
                : 'bg-red-50 border-2 border-red-400'}`}>
              <div className="text-5xl mb-3">
                {result.status === 'approved' ? '✅' : '❌'}
              </div>
              {result.status === 'approved' ? (
                <>
                  <p className="text-lg font-bold text-green-800">
                    {result.employee_name || result.employee_number}
                  </p>
                  <p className="text-green-700 text-sm">{result.service_name}</p>
                  <p className="text-3xl font-bold text-green-900 mt-2">
                    ${result.price?.toFixed(2)}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    {fmtTicketDate(result.timestamp)}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      onClick={handleReprint}
                      className="flex items-center gap-1.5 text-xs text-green-700 border border-green-400 rounded-lg px-3 py-1.5 hover:bg-green-100 transition-colors"
                    >
                      🖨️ Reimprimir
                    </button>
                    <button
                      onClick={() => setShowTicket(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 transition-colors"
                    >
                      {showTicket ? '🔼 Ocultar' : '🧾 Ver ticket'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-red-700 font-semibold">{result.reason}</p>
              )}
            </div>
          )}

          {/* ── Ticket para impresora térmica 80mm ── */}
          <div id="sdc-ticket" className={showTicket && result?.status === 'approved' ? 'sdc-ticket-preview' : ''}>
            {result?.status === 'approved' && (
              <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12pt', fontWeight: 'bold', lineHeight: '1.55', width: '100%', color: '#000' }}>

                {/* Encabezado */}
                <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                  <div>================================</div>
                  <div style={{ fontSize: '13pt', letterSpacing: '1px' }}>CafeteriaMS</div>
                  <div>================================</div>
                </div>

                {/* Datos de empresa y empleado */}
                <div style={{ margin: '4px 0' }}>
                  {[
                    ['Empresa',  session?.client_name        ],
                    ['Empleado', result.employee_name || '—' ],
                    ['No. Emp',  result.employee_number      ],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                      <span>{label}:</span>
                      <span style={{ textAlign: 'right', maxWidth: '58%', wordBreak: 'break-all' }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ margin: '5px 0' }}>--------------------------------</div>

                {/* Servicio */}
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                  <span>Servicio:</span>
                  <span>{result.service_name}</span>
                </div>

                {/* Precio destacado */}
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '15pt' }}>
                  <span>Precio:</span>
                  <span>${result.price?.toFixed(2)}</span>
                </div>

                <div style={{ margin: '5px 0' }}>--------------------------------</div>

                {/* Fecha y folio */}
                <div style={{ margin: '4px 0' }}>
                  {[
                    ['Fecha', fmtTicketDate(result.timestamp)],
                    ['Folio', `#${result.purchase_id}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                      <span>{label}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Pie */}
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                  <div>================================</div>
                  <div style={{ fontSize: '13pt', letterSpacing: '1px' }}>¡Buen provecho!</div>
                  <div>================================</div>
                  <div style={{ marginTop: '14px' }}>&nbsp;</div>
                </div>

              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
