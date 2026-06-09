import { useState, useEffect } from 'react'
import api from '../api'

export default function Reports() {
  const [clients,      setClients]      = useState([])
  const [filters,      setFilters]      = useState({ client_id: '', from: '', to: '' })
  const [downloading,  setDownloading]  = useState(null)  // 'detail' | 'payroll' | null
  const [reportError,  setReportError]  = useState(null)

  useEffect(() => { api.get('/clients').then(r => setClients(r.data)) }, [])

  const download = async (type) => {
    if (downloading) return
    setDownloading(type)
    setReportError(null)
    const params = new URLSearchParams()
    if (filters.client_id) params.append('client_id', filters.client_id)
    if (filters.from) params.append('from', filters.from)
    if (filters.to) params.append('to', filters.to)
    try {
      const res = await api.get(`/purchases/report/${type}?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'detail' ? 'reporte_detalle.xlsx' : 'reporte_nomina.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setReportError(e.response?.data?.error || e.message || 'Error desconocido al generar el reporte')
    } finally {
      setDownloading(null)
    }
  }

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Reportes</h1>

      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="text-sm font-semibold mb-4 text-gray-700">Filtros del reporte</h2>
        <div className="flex flex-col gap-3 mb-6">
          <div>
            <label className="text-xs text-gray-600 block mb-0.5">Cliente</label>
            <select value={filters.client_id} onChange={e=>setF('client_id',e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
              <option value="">Todos los clientes</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">Fecha desde</label>
              <input type="date" value={filters.from} onChange={e=>setF('from',e.target.value)} className="w-full border rounded px-2 py-1 text-sm"/>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-0.5">Fecha hasta</label>
              <input type="date" value={filters.to} onChange={e=>setF('to',e.target.value)} className="w-full border rounded px-2 py-1 text-sm"/>
            </div>
          </div>
        </div>

        {reportError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            ❌ {reportError}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button onClick={() => download('detail')} disabled={!!downloading}
            className="flex items-center gap-3 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg p-4 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            <span className="text-2xl">{downloading === 'detail' ? '⏳' : '📋'}</span>
            <div>
              <div className="font-semibold text-navy-900">
                {downloading === 'detail' ? 'Generando Excel...' : 'Reporte Desglosado'}
              </div>
              <div className="text-xs text-primary">Todas las transacciones con detalle por empleado y fecha</div>
            </div>
          </button>

          <button onClick={() => download('payroll')} disabled={!!downloading}
            className="flex items-center gap-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-4 text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            <span className="text-2xl">{downloading === 'payroll' ? '⏳' : '📅'}</span>
            <div>
              <div className="font-semibold text-green-800">
                {downloading === 'payroll' ? 'Generando Excel...' : 'Reporte Cierre de Mes'}
              </div>
              <div className="text-xs text-green-600">Total por empleado y tipo de servicio para cierre mensual</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
