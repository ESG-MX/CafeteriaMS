import { useState, useEffect } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_LABEL  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DAY_FULL   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const DEFAULT_START = '07:00'
const DEFAULT_END   = '22:00'

function allSevenDays() {
  return WEEK_ORDER.map(d => ({ day_of_week: d, start_time: DEFAULT_START, end_time: DEFAULT_END, id: null }))
}

// ── Sección de horarios ───────────────────────────────────────────
function ScheduleSection({ serviceId }) {
  const [rows, setRows]       = useState([])
  const [removed, setRemoved] = useState([])
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const usedDays     = rows.map(r => r.day_of_week)
  const availableDays = WEEK_ORDER.filter(d => !usedDays.includes(d))

  useEffect(() => {
    if (!serviceId) return
    api.get('/schedules').then(r => {
      const existing = r.data
        .filter(s => s.service_type_id === serviceId)
        .map(s => ({ id: s.id, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time }))
      setRows(existing.length ? existing : allSevenDays())
    })
  }, [serviceId])

  const updateRow = (idx, field, val) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))

  const removeRow = (idx) => {
    const row = rows[idx]
    if (row.id) setRemoved(prev => [...prev, row.id])
    setRows(prev => prev.filter((_, i) => i !== idx))
    setSaved(false)
  }

  const addDay = (d) => {
    setRows(prev => [...prev, { id: null, day_of_week: d, start_time: DEFAULT_START, end_time: DEFAULT_END }])
    setSaved(false)
  }

  const saveAll = async () => {
    setSaving(true); setSaved(false)
    try {
      for (const id of removed) await api.delete(`/schedules/${id}`)
      for (const row of rows) {
        if (row.id) {
          await api.put(`/schedules/${row.id}`, {
            service_type_id: serviceId, day_of_week: row.day_of_week,
            start_time: row.start_time, end_time: row.end_time, active: 1
          })
        } else {
          const r = await api.post('/schedules', {
            service_type_id: serviceId, day_of_week: row.day_of_week,
            start_time: row.start_time, end_time: row.end_time
          })
          setRows(prev => {
            const copy = [...prev]
            const idx = copy.findIndex(x => !x.id && x.day_of_week === row.day_of_week)
            if (idx >= 0) copy[idx] = { ...copy[idx], id: r.data.id }
            return copy
          })
        }
      }
      setRemoved([]); setSaved(true)
    } finally { setSaving(false) }
  }

  return (
    <div className="border-t pt-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">🕐 Horarios de disponibilidad</h3>
        {saved && <span className="text-xs text-green-600 font-medium">✓ Guardado</span>}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 mb-3 italic">Sin días configurados.</p>
      ) : (
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-[64px_1fr_1fr_32px] gap-2 px-1">
            <span className="text-xs text-gray-400 font-medium">Día</span>
            <span className="text-xs text-gray-400 font-medium">Inicio</span>
            <span className="text-xs text-gray-400 font-medium">Fin</span>
            <span/>
          </div>
          {rows.slice().sort((a,b) => WEEK_ORDER.indexOf(a.day_of_week) - WEEK_ORDER.indexOf(b.day_of_week))
            .map((row, si) => {
              const realIdx = rows.findIndex(r => r.day_of_week === row.day_of_week && r.start_time === row.start_time)
              return (
                <div key={`${row.day_of_week}-${si}`}
                  className="grid grid-cols-[64px_1fr_1fr_32px] gap-2 items-center bg-primary-50 border border-primary-100 rounded-lg px-2 py-1.5">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">
                    {DAY_LABEL[row.day_of_week]}
                  </span>
                  <input type="time" value={row.start_time}
                    onChange={e => updateRow(realIdx, 'start_time', e.target.value)}
                    className="border rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary bg-white"/>
                  <input type="time" value={row.end_time}
                    onChange={e => updateRow(realIdx, 'end_time', e.target.value)}
                    className="border rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary bg-white"/>
                  <button onClick={() => removeRow(realIdx)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-red-400 hover:bg-red-100 transition-colors text-sm">
                    ✕
                  </button>
                </div>
              )
            })
          }
        </div>
      )}

      {availableDays.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="text-xs text-gray-400 self-center">+ Agregar:</span>
          {availableDays.map(d => (
            <button key={d} onClick={() => addDay(d)}
              className="px-2.5 py-1 bg-white border border-dashed border-gray-300 hover:border-primary hover:bg-primary-50 hover:text-primary rounded-full text-xs text-gray-500 transition-colors">
              {DAY_FULL[d]}
            </button>
          ))}
        </div>
      )}

      <button onClick={saveAll} disabled={saving || rows.length === 0}
        className="w-full py-2 bg-primary hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
        {saving ? 'Guardando...' : '💾 Guardar horarios'}
      </button>
    </div>
  )
}

// ── Modal crear / editar servicio ─────────────────────────────────
function ServiceModal({ svc, clientId, autoAssign, onClose, onSave }) {
  const [form, setForm] = useState(
    svc?.id
      ? { name: svc.name, description: svc.description || '', price: svc.price, active: svc.active }
      : { name: '', description: '', price: '', active: 1 }
  )
  const [savedId, setSavedId] = useState(svc?.id || null)
  const [saved,   setSaved]   = useState(!!svc?.id)
  const [saving,  setSaving]  = useState(false)

  const save = async () => {
    if (!form.name || form.price === '') return alert('Nombre y precio requeridos')
    setSaving(true)
    try {
      if (savedId) {
        await api.put(`/services/${savedId}`, form)
        onSave()
      } else {
        const r = await api.post('/services', form)
        const newId = r.data.id
        if (clientId && autoAssign) {
          await api.post(`/clients/${clientId}/services`, { service_type_id: newId })
        }
        setSavedId(newId)
        setSaved(true)
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        <div className="flex items-center justify-between px-7 py-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{svc?.id ? 'Editar Servicio' : 'Nuevo Servicio'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {!savedId ? 'Completa los datos y define los horarios' : form.name}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors text-lg">
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden divide-x divide-gray-100">
          {/* Datos */}
          <div className="w-72 shrink-0 flex flex-col justify-between p-6 overflow-auto">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Información</p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Nombre *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="Ej. Desayuno, Comida..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Precio *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" step="0.01" min="0" value={form.price}
                      onChange={e => setForm({...form, price: e.target.value})}
                      placeholder="0.00"
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Descripción</label>
                  <textarea value={form.description}
                    onChange={e => setForm({...form, description: e.target.value})}
                    rows={3} placeholder="Descripción opcional..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary transition"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Estado</label>
                  <div className="flex gap-2">
                    {[1,0].map(v => (
                      <button key={v} type="button" onClick={() => setForm({...form, active: v})}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all
                          ${form.active === v
                            ? v === 1 ? 'bg-green-50 border-green-400 text-green-700' : 'bg-red-50 border-red-400 text-red-600'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                        {v === 1 ? '✓ Activo' : '✕ Inactivo'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={save} disabled={saving}
              className="mt-6 w-full py-2.5 bg-primary hover:bg-primary-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Guardando...' : savedId ? '💾 Guardar cambios' : 'Guardar y activar horarios →'}
            </button>
          </div>

          {/* Horarios */}
          <div className="flex-1 flex flex-col overflow-auto p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Horarios de disponibilidad
            </p>
            {savedId ? (
              <ScheduleSection serviceId={savedId} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-300 gap-3 select-none">
                <span className="text-6xl">🕐</span>
                <p className="text-sm text-gray-400">Los horarios se configuran<br/>después de guardar el servicio</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end px-6 py-3 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={saved ? onSave : onClose}
            className="px-5 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-100 transition-colors">
            {saved ? 'Finalizar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal asignar servicio existente ──────────────────────────────
function AssignModal({ unassigned, onAssign, onCreateNew, onClose }) {
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    if (!selected) return
    setSaving(true)
    try { await onAssign(Number(selected)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Asignar servicio</h2>
        <p className="text-sm text-gray-400 mb-5">Selecciona un servicio del catálogo o crea uno nuevo.</p>

        {unassigned.length > 0 ? (
          <>
            <label className="text-xs font-medium text-gray-600 block mb-1">Del catálogo global</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">— Elige un servicio —</option>
              {unassigned.map(s => (
                <option key={s.id} value={s.id}>{s.name} — ${Number(s.price).toFixed(2)}</option>
              ))}
            </select>
            <button onClick={confirm} disabled={!selected || saving}
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-semibold mb-3 disabled:opacity-40 transition-colors hover:bg-primary-500">
              {saving ? 'Asignando...' : 'Asignar servicio seleccionado'}
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-lg px-4 py-3 mb-4">
            Todos los servicios del catálogo ya están asignados a esta empresa.
          </p>
        )}

        <button onClick={onCreateNew}
          className="w-full py-2.5 border-2 border-dashed border-primary/40 text-primary rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors mb-2">
          + Crear nuevo tipo de servicio
        </button>
        <button onClick={onClose}
          className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function Services() {
  const { session } = useAuth()
  const isAdmin = session.role === 'super_admin'

  const [clients, setClients]           = useState([])
  const [selectedId, setSelectedId]     = useState(null)
  const [selectedName, setSelectedName] = useState('')
  const [clientSvcs, setClientSvcs]     = useState([])  // servicios de la empresa seleccionada
  const [catalog, setCatalog]           = useState([])  // catálogo global (super_admin)
  const [schedCounts, setSchedCounts]   = useState({})
  const [modal, setModal]               = useState(null)
  const [showAssign, setShowAssign]     = useState(false)

  const loadClientSvcs = (clientId) =>
    api.get(`/clients/${clientId}`).then(r => setClientSvcs(r.data.services || []))

  const loadCatalog = () =>
    api.get('/services').then(r => setCatalog(r.data.filter(s => s.active)))

  const loadSchedCounts = () =>
    api.get('/schedules').then(r => {
      const counts = {}
      r.data.forEach(s => { counts[s.service_type_id] = (counts[s.service_type_id] || 0) + 1 })
      setSchedCounts(counts)
    })

  useEffect(() => {
    loadSchedCounts()
    if (isAdmin) {
      api.get('/clients').then(r => {
        const active = r.data.filter(c => c.active)
        setClients(active)
        if (active.length) { setSelectedId(active[0].id); setSelectedName(active[0].name) }
      })
      loadCatalog()
    } else {
      setSelectedId(session.client_id)
      setSelectedName(session.client_name)
    }
  }, [])

  useEffect(() => { if (selectedId) loadClientSvcs(selectedId) }, [selectedId])

  const assignedIds = clientSvcs.map(s => s.service_type_id)
  const unassigned  = catalog.filter(s => !assignedIds.includes(s.id))

  const assignService = async (serviceTypeId) => {
    await api.post(`/clients/${selectedId}/services`, { service_type_id: serviceTypeId })
    await loadClientSvcs(selectedId)
    setShowAssign(false)
  }

  const removeService = async (serviceTypeId, serviceName) => {
    if (!window.confirm(`¿Quitar "${serviceName}" de ${selectedName}?`)) return
    await api.delete(`/clients/${selectedId}/services/${serviceTypeId}`)
    setClientSvcs(prev => prev.filter(s => s.service_type_id !== serviceTypeId))
  }

  const handleSaved = () => {
    setModal(null)
    loadClientSvcs(selectedId)
    loadSchedCounts()
    if (isAdmin) loadCatalog()
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Servicios</h1>
        {isAdmin && (
          <button onClick={() => setShowAssign(true)}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors">
            + Asignar / Nuevo
          </button>
        )}
      </div>

      {/* ── Selector de empresa (super_admin) ── */}
      {isAdmin && clients.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {clients.map(c => (
            <button key={c.id}
              onClick={() => { setSelectedId(c.id); setSelectedName(c.name) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${selectedId === c.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Label empresa ── */}
      {selectedName && (
        <p className="text-sm text-gray-500 mb-5">
          🏢 <strong>{selectedName}</strong> — {clientSvcs.length} servicio{clientSvcs.length !== 1 ? 's' : ''} asignado{clientSvcs.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Grid de servicios ── */}
      {clientSvcs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-3">
          <span className="text-5xl">🍽️</span>
          <p className="text-gray-400 font-medium">Esta empresa no tiene servicios asignados</p>
          {isAdmin && (
            <button onClick={() => setShowAssign(true)}
              className="mt-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors">
              Asignar primer servicio
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientSvcs.map(s => (
            <div key={s.service_type_id}
              className="bg-white rounded-xl shadow p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800">{s.service_name}</h3>
                  {s.service_description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{s.service_description}</p>
                  )}
                </div>
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium shrink-0
                  ${s.service_active !== 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {s.service_active !== 0 ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary">
                  ${Number(s.service_price).toFixed(2)}
                </span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs flex items-center gap-1 ${schedCounts[s.service_type_id] ? 'text-primary' : 'text-gray-400'}`}>
                    🕐 {schedCounts[s.service_type_id] || 0} día{schedCounts[s.service_type_id] !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setModal({
                      id: s.service_type_id,
                      name: s.service_name,
                      description: s.service_description || '',
                      price: s.service_price,
                      active: s.service_active ?? 1,
                    })}
                    className="text-primary hover:underline text-xs font-medium">
                    Editar
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => removeService(s.service_type_id, s.service_name)}
                      className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modales ── */}
      {showAssign && (
        <AssignModal
          unassigned={unassigned}
          onAssign={assignService}
          onCreateNew={() => { setShowAssign(false); setModal({}) }}
          onClose={() => setShowAssign(false)}
        />
      )}

      {modal !== null && (
        <ServiceModal
          svc={modal?.id ? modal : null}
          clientId={selectedId}
          autoAssign={!modal?.id}
          onClose={() => setModal(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
