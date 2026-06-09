const express = require('express')
const router  = express.Router()
const bcrypt  = require('bcrypt')
const db      = require('../db')
const { auth, adminOnly } = require('../middleware/auth')

router.use(auth)

// GET — super_admin ve todos; admin_empresa ve solo los de su empresa
router.get('/', async (req, res) => {
  try {
    let q = `SELECT u.id, u.username, u.role, u.active, u.client_id,
                    c.name as client_name
             FROM users u LEFT JOIN clients c ON u.client_id = c.id`
    const params = []
    if (req.user.role !== 'super_admin') {
      q += ' WHERE u.client_id = ?'
      params.push(req.user.client_id)
    }
    q += ' ORDER BY u.role, u.username'
    res.json(await db.allAsync(q, params))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/', adminOnly, async (req, res) => {
  const { username, password, role, client_id } = req.body
  if (!username || !password || !role)
    return res.status(400).json({ error: 'Campos requeridos: username, password, role' })
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })
  if (role === 'admin_empresa' && !client_id)
    return res.status(400).json({ error: 'admin_empresa requiere empresa' })
  try {
    const hashed = await bcrypt.hash(password, 10)
    const r = await db.runAsync(
      'INSERT INTO users (username, password, role, client_id) VALUES (?, ?, ?, ?)',
      [username, hashed, role, client_id || null]
    )
    res.json({ id: r.lastID })
  } catch { res.status(400).json({ error: 'El usuario ya existe' }) }
})

router.put('/:id', adminOnly, async (req, res) => {
  const { username, password, role, client_id, active } = req.body
  try {
    // Proteger al super_admin: no se puede desactivar ni cambiar su rol
    const target = await db.getAsync('SELECT * FROM users WHERE id=?', [req.params.id])
    if (target?.role === 'super_admin' && req.user.id !== target.id) {
      return res.status(403).json({ error: 'No se puede modificar al administrador principal' })
    }
    if (password) {
      const hashed = await bcrypt.hash(password, 10)
      await db.runAsync(
        'UPDATE users SET username=?, password=?, role=?, client_id=?, active=? WHERE id=?',
        [username, hashed, role, client_id || null, active ?? 1, req.params.id]
      )
    } else {
      await db.runAsync(
        'UPDATE users SET username=?, role=?, client_id=?, active=? WHERE id=?',
        [username, role, client_id || null, active ?? 1, req.params.id]
      )
    }
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.delete('/:id', adminOnly, async (req, res) => {
  // Proteger al super_admin de eliminación
  const target = await db.getAsync('SELECT role FROM users WHERE id=?', [req.params.id])
  if (target?.role === 'super_admin') {
    return res.status(403).json({ error: 'No se puede eliminar al administrador principal' })
  }
  await db.runAsync('UPDATE users SET active=0 WHERE id=?', [req.params.id])
  res.json({ ok: true })
})

module.exports = router
