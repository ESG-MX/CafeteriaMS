import { useState, useEffect } from 'react'
import api from '../api'

function Modal({ client, services, allServices, onClose, onSave }) {
  const [form, setForm] = useState(client || { name: '', rfc: '', contact: '', phone: '', email: '', active: 1 })
  const [addSvc, setAddSvc] = useState('')
  const [dailyLim, setDailyLim] = useState(0)
  const [weeklyLim, setWeeklyLim] = useState(0)
  const [svcList, setSvcList] = useState(services || [])

  const save = async () => {
    if (!form.name) return alert('Nombre requerido')
    if (client?.id) await api.put(`/clients/${client.id}`, form)
    else await api.post('/clients', form)
    onSave()
  }

  const addService = async () => {
    if (!addSvc) return
    await api.post(`/clients/${client.id}/services`, { service_type_id: addSvc, daily_limit: dailyLim, weekly_limit: weeklyLim })
    const res = await api.get(`/clients/${client.id}`)
    setSvcList(res.data.services)
    setAddSvc('')
  }

  const removeService = async (sid) => {
    await api.delete(`/clients/${client.id}/services/${sid}`)
    setSvcList(s => s.filter(x => x.service_type_id !== sid))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{client?.id ? 'Editar' : 'Nuevo'} Cliente</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[['name','Nombre*'],['rfc','RFC'],['contact','Contacto'],['phone','Teléfono'],['email','Email']].map(([k,l]) => (
            <div key={k} className={k==='name'?'col-span-2':''}>
              <label className="text-xs text-gray-600">{l}</label>
              <input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}
                className="w-full border rounded px-2 py-1 text-sm mt-0.5"/>
            </div>
          ))}
          <div className="col-span-2">
            <label className="text-xs text-gray-600">Estado</label>
            <select value={form.active} onChange={e=>setForm({...form,active:+e.target.value})}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5">
              <option value={1}>Activo</option><option value={0}>Inactivo</option>
            </select>
          </div>
        </div>

        {client?.id && (
          <div className="border-t pt-4 mb-4">
            <h3 className="text-sm font-semibold mb-2">Servicios contratados</h3>
            <div className="flex gap-2 mb-2 flex-wrap">
              <select value={addSvc} onChange={e=>setAddSvc(e.target.value)} className="border rounded px-2 py-1 text-xs flex-1">
                <option value="">— Servicio —</option>
                {allServices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="number" placeholder="Límite/día" value={dailyLim} onChange={e=>setDailyLim(+e.target.value)} className="border rounded px-2 py-1 text-xs w-24"/>
              <input type="number" placeholder="Límite/semana" value={weeklyLim} onChange={e=>setWeeklyLim(+e.target.value)} className="border rounded px-2 py-1 text-xs w-28"/>
              <button onClick={addService} className="bg-primary text-white px-3 py-1 rounded text-xs">+ Agregar</button>
            </div>
            {svcList.map(s => (
              <div key={s.service_type_id} className="flex items-center gap-2 text-sm py-1 border-b">
                <span className="flex-1">{s.service_name}</span>
                <span className="text-xs text-gray-500">D:{s.daily_limit} S:{s.weekly_limit}</span>
                <button onClick={()=>removeService(s.service_type_id)} className="text-red-500 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancelar</button>
          <button onClick={save} className="px-4 py-2 rounded bg-primary text-white text-sm">Guardar</button>
        </div>
      </div>
    </div>
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [allServices, setAllServices] = useState([])
  const [modal, setModal] = useState(null)

  const load = async () => {
    const [c, s] = await Promise.all([api.get('/clients'), api.get('/services')])
    setClients(c.data)
    setAllServices(s.data)
  }

  useEffect(() => { load() }, [])

  const openEdit = async (c) => {
    const res = await api.get(`/clients/${c.id}`)
    setModal({ client: res.data, services: res.data.services })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
        <button onClick={() => setModal({ client: null, services: [] })}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm">+ Nuevo Cliente</button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Nombre','RFC','Contacto','Teléfono','Estado',''].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.rfc}</td>
                <td className="px-4 py-3 text-gray-500">{c.contact}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {c.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(c)} className="text-primary hover:underline text-xs">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          client={modal.client}
          services={modal.services}
          allServices={allServices}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
