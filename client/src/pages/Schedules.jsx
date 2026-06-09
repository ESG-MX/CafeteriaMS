import { useState, useEffect } from 'react'
import api from '../api'

const DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export default function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [services, setServices] = useState([])
  const [form, setForm] = useState({ service_type_id: '', day_of_week: 1, start_time: '07:00', end_time: '10:00' })

  const load = async () => {
    const [s, sv] = await Promise.all([api.get('/schedules'), api.get('/services')])
    setSchedules(s.data)
    setServices(sv.data.filter(x => x.active))
  }

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.service_type_id) return alert('Selecciona un servicio')
    await api.post('/schedules', form)
    load()
  }

  const toggle = async (s) => {
    await api.put(`/schedules/${s.id}`, { ...s, active: s.active ? 0 : 1 })
    load()
  }

  const remove = async (id) => {
    await api.delete(`/schedules/${id}`)
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Horarios de Servicio</h1>

      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <h2 className="text-sm font-semibold mb-3">Agregar horario</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-600 block">Servicio</label>
            <select value={form.service_type_id} onChange={e=>setForm({...form,service_type_id:e.target.value})}
              className="border rounded px-2 py-1 text-sm mt-0.5">
              <option value="">— Seleccionar —</option>
              {services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block">Día</label>
            <select value={form.day_of_week} onChange={e=>setForm({...form,day_of_week:+e.target.value})}
              className="border rounded px-2 py-1 text-sm mt-0.5">
              {DAYS.map((d,i)=><option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block">Hora inicio</label>
            <input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}
              className="border rounded px-2 py-1 text-sm mt-0.5"/>
          </div>
          <div>
            <label className="text-xs text-gray-600 block">Hora fin</label>
            <input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}
              className="border rounded px-2 py-1 text-sm mt-0.5"/>
          </div>
          <button onClick={add} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">+ Agregar</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Servicio','Día','Inicio','Fin','Estado',''].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody>
            {schedules.map(s => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.service_name}</td>
                <td className="px-4 py-3">{s.day_name}</td>
                <td className="px-4 py-3">{s.start_time}</td>
                <td className="px-4 py-3">{s.end_time}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={()=>toggle(s)} className="text-indigo-600 hover:underline text-xs">{s.active?'Desactivar':'Activar'}</button>
                  <button onClick={()=>remove(s.id)} className="text-red-500 hover:underline text-xs">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
