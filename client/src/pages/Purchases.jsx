import { useState, useEffect } from 'react'
import api from '../api'

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [clients, setClients] = useState([])
  const [services, setServices] = useState([])
  const [filters, setFilters] = useState({ client_id: '', from: '', to: '', service_type_id: '' })

  const load = async () => {
    const [p, c, s] = await Promise.all([
      api.get('/purchases', { params: filters }),
      api.get('/clients'),
      api.get('/services')
    ])
    setPurchases(p.data)
    setClients(c.data)
    setServices(s.data)
  }

  useEffect(() => { load() }, [])

  const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  const total = purchases.filter(p => p.status === 'approved').reduce((s, p) => s + p.price, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Historial de Compras</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-600 block">Cliente</label>
          <select value={filters.client_id} onChange={e=>setF('client_id',e.target.value)} className="border rounded px-2 py-1 text-sm mt-0.5">
            <option value="">Todos</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block">Servicio</label>
          <select value={filters.service_type_id} onChange={e=>setF('service_type_id',e.target.value)} className="border rounded px-2 py-1 text-sm mt-0.5">
            <option value="">Todos</option>
            {services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block">Desde</label>
          <input type="date" value={filters.from} onChange={e=>setF('from',e.target.value)} className="border rounded px-2 py-1 text-sm mt-0.5"/>
        </div>
        <div>
          <label className="text-xs text-gray-600 block">Hasta</label>
          <input type="date" value={filters.to} onChange={e=>setF('to',e.target.value)} className="border rounded px-2 py-1 text-sm mt-0.5"/>
        </div>
        <button onClick={load} className="bg-primary text-white px-4 py-2 rounded text-sm">Buscar</button>
        <div className="ml-auto text-right">
          <div className="text-xs text-gray-500">Total aprobado</div>
          <div className="text-xl font-bold text-primary-500">${total.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Fecha/Hora','Cliente','No. Emp.','Empleado','Servicio','Precio','Estado'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(p.created_at).toLocaleString('es-MX')}</td>
                <td className="px-4 py-2 text-xs">{p.client_name}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.employee_number}</td>
                <td className="px-4 py-2 text-xs">{p.employee_name || '—'}</td>
                <td className="px-4 py-2 text-xs">{p.service_name}</td>
                <td className="px-4 py-2 font-medium">${p.price.toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.status==='approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {p.status==='approved' ? 'Aprobado' : 'Rechazado'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 && <p className="text-center text-gray-400 py-8">Sin registros</p>}
        {purchases.length === 1000 && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            ⚠️ Se muestran los primeros <strong>1,000 registros</strong>. Usa los filtros de fecha para ver un rango más específico.
          </div>
        )}
      </div>
    </div>
  )
}
