import { useState, useEffect } from 'react'
import api from '../api'

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin_empresa: 'Admin Empresa',
  scanner: 'Scanner',
}
const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-700',
  admin_empresa: 'bg-blue-100 text-blue-700',
  scanner: 'bg-green-100 text-green-700',
}

function UserModal({ user, clients, onClose, onSave }) {
  const [form, setForm] = useState(user || { username: '', password: '', role: 'admin_empresa', client_id: '', active: 1 })

  const save = async () => {
    if (!form.username || (!user?.id && !form.password)) return alert('Usuario y contraseña requeridos')
    try {
      if (user?.id) await api.put(`/users/${user.id}`, form)
      else await api.post('/users', form)
      onSave()
    } catch (e) { alert(e.response?.data?.error || 'Error al guardar') }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-4">{user?.id ? 'Editar' : 'Nuevo'} Usuario</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-600">Usuario</label>
            <input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5"/>
          </div>
          <div>
            <label className="text-xs text-gray-600">{user?.id ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña *'}</label>
            <input type="password" value={form.password||''} onChange={e=>setForm({...form,password:e.target.value})}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5"/>
          </div>
          <div>
            <label className="text-xs text-gray-600">Rol</label>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5">
              <option value="super_admin">Super Admin</option>
              <option value="admin_empresa">Admin Empresa</option>
              <option value="scanner">Scanner</option>
            </select>
          </div>
          {(form.role === 'admin_empresa' || form.role === 'scanner') && (
            <div>
              <label className="text-xs text-gray-600">Empresa</label>
              <select value={form.client_id||''} onChange={e=>setForm({...form,client_id:e.target.value})}
                className="w-full border rounded px-2 py-1 text-sm mt-0.5">
                <option value="">— Seleccionar —</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-600">Estado</label>
            <select value={form.active} onChange={e=>setForm({...form,active:+e.target.value})}
              className="w-full border rounded px-2 py-1 text-sm mt-0.5">
              <option value={1}>Activo</option><option value={0}>Inactivo</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancelar</button>
          <button onClick={save} className="px-4 py-2 rounded bg-primary text-white text-sm">Guardar</button>
        </div>
      </div>
    </div>
  )
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [modal, setModal] = useState(null)

  const load = async () => {
    const [u, c] = await Promise.all([api.get('/users'), api.get('/clients')])
    setUsers(u.data)
    setClients(c.data.filter(x => x.active))
  }
  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios del Sistema</h1>
        <button onClick={() => setModal({})} className="bg-primary text-white px-4 py-2 rounded-lg text-sm">+ Nuevo Usuario</button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Usuario','Rol','Empresa','Estado',''].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium font-mono">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.client_name || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setModal(u)} className="text-primary hover:underline text-xs">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <UserModal user={modal?.id ? modal : null} clients={clients}
          onClose={() => setModal(null)} onSave={() => { setModal(null); load() }} />
      )}
    </div>
  )
}
