import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import Toggle from '../components/Toggle'

// ── Modal de empleado ─────────────────────────────────────────────
function EmpModal({ emp, clients, onClose, onSave, session }) {
  const allServices = emp?.companyServices || []
  const isSuperAdmin = session?.role === 'super_admin'
  const defaultClientId = emp?.id ? emp.client_id : (isSuperAdmin ? '' : session?.client_id || '')

  const [form, setForm] = useState(emp?.id
    ? { employee_number: emp.employee_number, name: emp.name||'', email: emp.email||'', department: emp.department||'', position: emp.position||'', client_id: emp.client_id, active: emp.active }
    : { employee_number: '', name: '', email: '', department: '', position: '', client_id: defaultClientId, active: 1, minimal: false })

  const [rfidCode, setRfidCode] = useState('')
  const [rfidMsg,  setRfidMsg]  = useState('')
  const [cards,    setCards]    = useState(emp?.rfid_cards || [])

  // Acceso a servicios: { [service_type_id]: { enabled, daily_limit, weekly_limit } }
  const [svcAccess, setSvcAccess] = useState(() => {
    const map = {}
    allServices.forEach(s => { map[s.id] = { enabled: true, daily_limit: 0, weekly_limit: 0 } })
    ;(emp?.services || []).forEach(sa => {
      map[sa.service_type_id] = { enabled: !!sa.enabled, daily_limit: sa.daily_limit, weekly_limit: sa.weekly_limit }
    })
    return map
  })
  const [svcSaving, setSvcSaving] = useState(false)
  const [svcSaved,  setSvcSaved]  = useState(false)

  const save = async () => {
    if (!form.employee_number || !form.client_id) return alert('Número de empleado y empresa requeridos')
    try {
      if (emp?.id) await api.put(`/employees/${emp.id}`, form)
      else await api.post('/employees', form)
      onSave()
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar') }
  }

  const assignRfid = async () => {
    if (!rfidCode.trim()) return
    try {
      await api.post(`/employees/${emp.id}/rfid`, { rfid_code: rfidCode.trim() })
      setRfidMsg('✅ Tarjeta asignada')
      setRfidCode('')
      const res = await api.get(`/employees/${emp.id}`)
      setCards(res.data.rfid_cards)
    } catch (e) { setRfidMsg('❌ ' + (e.response?.data?.error || 'Error')) }
  }

  const updateSvc = (svcId, field, val) => {
    setSvcAccess(prev => ({ ...prev, [svcId]: { ...prev[svcId], [field]: val } }))
    setSvcSaved(false)
  }

  const saveServices = async () => {
    setSvcSaving(true)
    try {
      const payload = allServices.map(s => ({
        service_type_id: s.id,
        enabled:      svcAccess[s.id]?.enabled ? 1 : 0,
        daily_limit:  svcAccess[s.id]?.daily_limit  || 0,
        weekly_limit: svcAccess[s.id]?.weekly_limit || 0,
      }))
      await api.put(`/employees/${emp.id}/services`, payload)
      setSvcSaved(true)
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar servicios') }
    finally { setSvcSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto p-6">
        <h2 className="text-lg font-bold mb-4">{emp?.id ? 'Editar' : 'Nuevo'} Empleado</h2>

        {!emp?.id && (
          <div className="mb-4 flex gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={!form.minimal} onChange={() => setForm({...form, minimal: false})}/>
              Datos completos
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={!!form.minimal} onChange={() => setForm({...form, minimal: true})}/>
              Solo número de empleado
            </label>
          </div>
        )}

        {/* Datos generales */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-600">Número de Empleado*</label>
            <input value={form.employee_number} onChange={e => setForm({...form, employee_number: e.target.value})}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5"/>
          </div>
          <div>
            <label className="text-xs text-gray-600">Empresa*</label>
            {isSuperAdmin ? (
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}
                className="w-full border rounded px-2 py-1 text-sm mt-0.5">
                <option value="">— Seleccionar —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <input
                value={clients.find(c => String(c.id) === String(form.client_id))?.name || session?.client_name || ''}
                readOnly
                className="w-full border rounded px-2 py-1 text-sm mt-0.5 bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            )}
          </div>

          {!form.minimal && <>
            {[['name','Nombre'],['email','Email'],['department','Departamento'],['position','Puesto']].map(([k,l]) => (
              <div key={k}>
                <label className="text-xs text-gray-600">{l}</label>
                <input value={form[k]||''} onChange={e => setForm({...form, [k]: e.target.value})}
                  className="w-full border rounded px-2 py-1 text-sm mt-0.5"/>
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-600">Estado</label>
              <select value={form.active} onChange={e => setForm({...form, active: +e.target.value})}
                className="w-full border rounded px-2 py-1 text-sm mt-0.5">
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
          </>}
        </div>

        {emp?.id && (
          <>
            {/* RFID */}
            <div className="border-t pt-4 mb-4">
              <h3 className="text-sm font-semibold mb-2">Tarjeta RFID</h3>
              <div className="flex gap-2 mb-2">
                <input value={rfidCode} onChange={e => setRfidCode(e.target.value)} placeholder="Código RFID"
                  className="flex-1 border rounded px-2 py-1 text-sm"/>
                <button onClick={assignRfid} className="bg-primary text-white px-3 py-1 rounded text-sm">Asignar</button>
              </div>
              {rfidMsg && <p className="text-xs mb-2">{rfidMsg}</p>}
              <div className="max-h-24 overflow-auto text-xs space-y-1">
                {cards.map(c => (
                  <div key={c.id} className={`flex justify-between px-2 py-1 rounded ${c.active ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <span className="font-mono">{c.rfid_code}</span>
                    <span className="text-gray-500">{c.active ? '✅ Activa' : '⬜ Histórico'} — {c.assigned_at?.slice(0,10)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acceso a servicios */}
            <div className="border-t pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold">Acceso a servicios</h3>
                  <p className="text-xs text-gray-400 mt-0.5">0 = sin límite</p>
                </div>
                <div className="flex items-center gap-2">
                  {svcSaved && <span className="text-xs text-green-600">✓ Guardado</span>}
                  <button onClick={saveServices} disabled={svcSaving}
                    className="bg-primary text-white px-3 py-1.5 rounded text-xs font-medium disabled:opacity-40">
                    {svcSaving ? 'Guardando...' : '💾 Guardar'}
                  </button>
                </div>
              </div>

              {/* Encabezados */}
              <div className="grid grid-cols-[1fr_56px_72px_72px] gap-2 px-2 pb-1 text-xs font-medium text-gray-400 uppercase">
                <span>Servicio</span>
                <span className="text-center">Acceso</span>
                <span className="text-center">Día</span>
                <span className="text-center">Semana</span>
              </div>

              <div className="space-y-1">
                {allServices.map(svc => {
                  const acc = svcAccess[svc.id] || { enabled: true, daily_limit: 0, weekly_limit: 0 }
                  return (
                    <div key={svc.id}
                      className={`grid grid-cols-[1fr_56px_72px_72px] gap-2 items-center px-2 py-2 rounded-lg border transition-colors
                        ${acc.enabled ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <span className={`text-sm font-medium ${acc.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                        {svc.name}
                      </span>
                      <div className="flex justify-center">
                        <Toggle enabled={!!acc.enabled} onChange={v => updateSvc(svc.id, 'enabled', v)} />
                      </div>
                      <input type="number" min="0" value={acc.daily_limit}
                        disabled={!acc.enabled}
                        onChange={e => updateSvc(svc.id, 'daily_limit', Math.max(0, +e.target.value))}
                        className="border rounded px-1 py-1 text-xs text-center w-full disabled:bg-gray-100 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"/>
                      <input type="number" min="0" value={acc.weekly_limit}
                        disabled={!acc.enabled}
                        onChange={e => updateSvc(svc.id, 'weekly_limit', Math.max(0, +e.target.value))}
                        className="border rounded px-1 py-1 text-xs text-center w-full disabled:bg-gray-100 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"/>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancelar</button>
          <button onClick={save} className="px-4 py-2 rounded bg-primary text-white text-sm">Guardar empleado</button>
        </div>
      </div>
    </div>
  )
}

// ── Gestión masiva de servicios (tabla con toggles) ───────────────
function BulkServicesPanel({ clientId, clients, isSuperAdmin, session }) {
  const [selectedClient, setSelectedClient] = useState(isSuperAdmin ? (clientId || '') : session?.client_id || '')
  const [rows, setRows]           = useState([])
  const [companyServices, setCompanyServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [dirty, setDirty]     = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError,  setUploadError]  = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const fileRef = useRef()

  const loadData = async (cid) => {
    if (!cid) return
    setLoading(true)
    try {
      // Una sola petición trae empleados + servicios (sin N+1)
      const [empRes, clientData] = await Promise.all([
        api.get('/employees/with-services', { params: { client_id: cid } }),
        api.get(`/clients/${cid}`),
      ])
      const companyServices = (clientData.data.services || [])
        .filter(s => s.service_active !== 0)
        .map(s => ({ id: s.service_type_id, name: s.service_name }))
      setCompanyServices(companyServices)

      const result = empRes.data.map(emp => {
        const svcMap = {}
        companyServices.forEach(s => { svcMap[s.id] = { enabled: true, daily_limit: 0, weekly_limit: 0 } })
        ;(emp.services || []).forEach(sa => {
          svcMap[sa.service_type_id] = { enabled: !!sa.enabled, daily_limit: sa.daily_limit, weekly_limit: sa.weekly_limit }
        })
        return { id: emp.id, employee_number: emp.employee_number, name: emp.name, services: svcMap }
      })
      setRows(result)
      setDirty(false)
      setSaved(false)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadData(selectedClient) }, [selectedClient])

  const updateCell = (empId, svcId, field, val) => {
    setRows(prev => prev.map(r =>
      r.id === empId
        ? { ...r, services: { ...r.services, [svcId]: { ...r.services[svcId], [field]: val } } }
        : r
    ))
    setDirty(true)
    setSaved(false)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      const payload = []
      for (const row of rows) {
        for (const [svcId, acc] of Object.entries(row.services)) {
          payload.push({
            employee_id: row.id,
            service_type_id: Number(svcId),
            enabled: acc.enabled ? 1 : 0,
            daily_limit: acc.daily_limit || 0,
            weekly_limit: acc.weekly_limit || 0,
          })
        }
      }
      await api.post('/employees/services/bulk', payload)
      setSaved(true)
      setDirty(false)
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar') }
    finally { setSaving(false) }
  }

  const downloadTemplate = async () => {
    const cid = selectedClient
    if (!cid) return alert('Selecciona una empresa')
    try {
      const res = await api.get('/employees/services-template', { params: { client_id: cid }, responseType: 'blob' })
      const url  = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url; link.download = 'servicios_empleados.xlsx'; link.click()
      URL.revokeObjectURL(url)
    } catch { alert('Error al descargar') }
  }

  const uploadTemplate = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const cid = selectedClient
    if (!cid) { setUploadError('Selecciona una empresa antes de subir'); return }
    setUploading(true)
    setUploadResult(null)
    setUploadError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('client_id', cid)
    try {
      const res = await api.post('/employees/services-bulk-upload', fd)
      setUploadResult(res.data)
      loadData(cid)
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Error al procesar el archivo')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 mb-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">🍽️ Gestión masiva de servicios</h2>
          <p className="text-xs text-gray-400 mt-0.5">Activa/desactiva servicios y define límites por empleado. 0 = sin límite.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 bg-navy-900 hover:opacity-90 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
            ⬇️ Descargar plantilla
          </button>
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
            ${uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
            {uploading ? '⏳ Procesando...' : '📤 Subir plantilla'}
            <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} onChange={uploadTemplate} className="hidden" disabled={uploading}/>
          </label>
          {dirty && (
            <button onClick={saveAll} disabled={saving}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40">
              {saving ? 'Guardando...' : '💾 Guardar cambios'}
            </button>
          )}
          {saved && !dirty && <span className="text-xs text-green-600 self-center">✓ Guardado</span>}
        </div>
      </div>

      {isSuperAdmin && (
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">Empresa</label>
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm">
            <option value="">— Seleccionar —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {uploadError && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ {uploadError}
        </div>
      )}
      {uploadResult && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <span className="font-medium text-blue-800">✅ Carga completada: </span>
          <span className="text-blue-700">{uploadResult.updated} empleados actualizados</span>
          {uploadResult.errors?.length > 0 && (
            <div className="text-red-600 text-xs mt-1">{uploadResult.errors.join(' | ')}</div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {selectedClient ? 'No hay empleados activos' : 'Selecciona una empresa'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">Empleado</th>
                {companyServices.map(svc => (
                  <th key={svc.id} className="px-2 py-2 text-gray-500 font-medium text-center min-w-[110px]">
                    {svc.name}
                    <div className="text-gray-400 font-normal">Acceso / Día / Sem</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium text-gray-800">{row.name || '—'}</div>
                    <div className="text-gray-400 font-mono">{row.employee_number}</div>
                  </td>
                  {companyServices.map(svc => {
                    const acc = row.services[svc.id] || { enabled: true, daily_limit: 0, weekly_limit: 0 }
                    return (
                      <td key={svc.id} className="px-2 py-2">
                        <div className="flex items-center gap-1 justify-center">
                          <Toggle enabled={!!acc.enabled}
                            onChange={v => updateCell(row.id, svc.id, 'enabled', v)} />
                          <input type="number" min="0" value={acc.daily_limit}
                            disabled={!acc.enabled}
                            onChange={e => updateCell(row.id, svc.id, 'daily_limit', Math.max(0, +e.target.value))}
                            className="w-10 border rounded px-1 py-0.5 text-center disabled:bg-gray-100 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"/>
                          <input type="number" min="0" value={acc.weekly_limit}
                            disabled={!acc.enabled}
                            onChange={e => updateCell(row.id, svc.id, 'weekly_limit', Math.max(0, +e.target.value))}
                            className="w-12 border rounded px-1 py-0.5 text-center disabled:bg-gray-100 disabled:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary"/>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────
export default function Employees() {
  const { session } = useAuth()
  const isSuperAdmin = session?.role === 'super_admin'

  const [employees,    setEmployees]    = useState([])
  const [clients,      setClients]      = useState([])
  const [filterClient, setFilterClient] = useState('')
  const [modal,        setModal]        = useState(null)
  const [bulkClient,   setBulkClient]   = useState(isSuperAdmin ? '' : session?.client_id || '')
  const [bulkResult,   setBulkResult]   = useState(null)
  const [bulkError,    setBulkError]    = useState(null)
  const [bulkLoading,  setBulkLoading]  = useState(false)
  const [bulkMode,     setBulkMode]     = useState('upsert')
  const fileRef = useRef()

  const load = async () => {
    const [e, c] = await Promise.all([
      api.get('/employees', { params: filterClient ? { client_id: filterClient } : {} }),
      api.get('/clients'),
    ])
    setEmployees(e.data)
    setClients(c.data.filter(x => x.active))
  }

  useEffect(() => { load() }, [filterClient])

  const openEdit = async (emp) => {
    const [empRes, clientRes] = await Promise.all([
      api.get(`/employees/${emp.id}`),
      api.get(`/clients/${emp.client_id}`),
    ])
    const companyServices = (clientRes.data.services || [])
      .filter(s => s.service_active !== 0)
      .map(s => ({ id: s.service_type_id, name: s.service_name }))
    setModal({ ...empRes.data, companyServices })
  }

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/employees/template', { responseType: 'blob' })
      const url  = URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url; link.download = 'plantilla_empleados.xlsx'; link.click()
      URL.revokeObjectURL(url)
    } catch { alert('Error al descargar la plantilla') }
  }

  const bulkUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!bulkClient) { setBulkError('Selecciona una empresa antes de subir'); return }
    setBulkLoading(true)
    setBulkResult(null)
    setBulkError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('client_id', bulkClient)
      fd.append('mode', bulkMode)
      const res = await api.post('/employees/bulk-upload', fd)
      setBulkResult(res.data)
      load()
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Error al procesar el archivo')
    } finally {
      setBulkLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Empleados</h1>
        {isSuperAdmin && (
          <button onClick={() => setModal({})} className="bg-primary text-white px-4 py-2 rounded-lg text-sm">
            + Nuevo Empleado
          </button>
        )}
      </div>

      {/* Filtro empresa */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <label className="text-xs text-gray-600 block mb-1">Filtrar por empresa</label>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="border rounded px-2 py-1 text-sm">
            <option value="">Todos</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Carga masiva empleados */}
      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">📋 Carga masiva de empleados</h2>
        <div className="flex flex-wrap gap-3 items-end">
          {isSuperAdmin ? (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Empresa</label>
              <select value={bulkClient} onChange={e => setBulkClient(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm">
                <option value="">— Seleccionar empresa —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Empresa</label>
              <input value={session?.client_name || ''} readOnly
                className="border rounded px-2 py-1.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed w-40"/>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Paso 1</span>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 bg-navy-900 hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium">
              ⬇️ Descargar Plantilla
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Paso 2 — Llena y sube</span>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
              ${bulkLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary text-white hover:opacity-90'}`}>
              {bulkLoading ? '⏳ Procesando...' : '📤 Subir Archivo (.xlsx / .csv)'}
              <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef}
                onChange={bulkUpload} className="hidden" disabled={bulkLoading}/>
            </label>
          </div>
        </div>

        {/* Modo de carga */}
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-xs font-medium text-gray-600">Modo de carga:</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="bulkMode" value="upsert"
                checked={bulkMode === 'upsert'}
                onChange={() => setBulkMode('upsert')}
                className="accent-primary"/>
              <span className="text-sm text-gray-700">
                <strong>Agregar / Actualizar</strong>
                <span className="text-xs text-gray-400 ml-1">— seguro para cargas por tandas</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="bulkMode" value="replace"
                checked={bulkMode === 'replace'}
                onChange={() => setBulkMode('replace')}
                className="accent-red-500"/>
              <span className="text-sm text-gray-700">
                <strong>Reemplazar lista completa</strong>
                <span className="text-xs text-gray-400 ml-1">— da de baja a los que no estén</span>
              </span>
            </label>
          </div>
          {bulkMode === 'replace' && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>
                <strong>Atención:</strong> Los empleados que no aparezcan en el archivo serán dados de baja.
                Usa este modo solo cuando subas la lista <strong>completa</strong> de la empresa.
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          💡 Columnas aceptadas: <strong>Numero</strong> (requerido), Nombre, Email, Departamento, Puesto.
        </p>
        {bulkError && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            ❌ {bulkError}
          </div>
        )}
      </div>

      {bulkResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-blue-800 mb-2">✅ Carga completada
            <span className="text-xs font-normal text-blue-500 ml-2">
              ({bulkResult.mode === 'replace' ? 'Reemplazar lista completa' : 'Agregar / Actualizar'})
            </span>
          </p>
          <div className="flex gap-4 text-sm flex-wrap">
            <span className="text-green-700">🟢 {bulkResult.created} creados</span>
            <span className="text-blue-700">🔵 {bulkResult.updated} actualizados</span>
            {bulkResult.mode === 'replace' && (
              <span className="text-gray-600">⚫ {bulkResult.deactivated} dados de baja</span>
            )}
          </div>
          {bulkResult.errors?.length > 0 && (
            <div className="text-red-600 text-xs mt-2">{bulkResult.errors.join(' | ')}</div>
          )}
        </div>
      )}

      {/* Gestión masiva de servicios */}
      <BulkServicesPanel
        clientId={filterClient || session?.client_id}
        clients={clients}
        isSuperAdmin={isSuperAdmin}
        session={session}
      />

      {/* Lista de empleados */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['No.','Nombre','Departamento','Empresa','RFID','Estado',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{e.employee_number}</td>
                <td className="px-4 py-3">{e.name || <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.department || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.client_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.rfid_code || <span className="text-red-400">Sin tarjeta</span>}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {e.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(e)} className="text-primary hover:underline text-xs">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <EmpModal
          emp={modal?.id ? modal : null}
          clients={clients}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
          session={session}
        />
      )}
    </div>
  )
}
