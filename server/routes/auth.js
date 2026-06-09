const express  = require('express')
const router   = express.Router()
const jwt      = require('jsonwebtoken')
const bcrypt   = require('bcrypt')
const db       = require('../db')
const { SECRET, auth } = require('../middleware/auth')

// POST /api/auth/login — login con usuario y contraseña
router.post('/login', async (req, res) => {
  const { username, password, client_id } = req.body
  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' })
  if (!client_id)
    return res.status(400).json({ error: 'Debes seleccionar una empresa' })

  try {
    const user = await db.getAsync(
      `SELECT u.*, c.name as client_name
       FROM users u LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.username = ? AND u.active = 1`,
      [username]
    )

    if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })

    // super_admin puede entrar a cualquier empresa seleccionada
    if (user.role === 'super_admin') {
      const selected = await db.getAsync('SELECT * FROM clients WHERE id=? AND active=1', [client_id])
      const payload  = {
        id: user.id, username: user.username, role: user.role,
        client_id: selected?.id || null, client_name: selected?.name || null,
      }
      return res.json({ ...payload, token: jwt.sign(payload, SECRET, { expiresIn: '12h' }) })
    }

    // admin_empresa y scanner: solo su propia empresa
    if (user.client_id !== Number(client_id))
      return res.status(403).json({ error: 'No tienes acceso a esta empresa' })

    const payload = {
      id: user.id, username: user.username, role: user.role,
      client_id: user.client_id, client_name: user.client_name,
    }
    res.json({ ...payload, token: jwt.sign(payload, SECRET, { expiresIn: '12h' }) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT /api/auth/change-password — cualquier usuario cambia su propia contraseña
router.put('/change-password', auth, async (req, res) => {
  const { current_password, new_password } = req.body
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' })
  if (new_password.length < 8)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' })
  try {
    const user = await db.getAsync('SELECT * FROM users WHERE id=?', [req.user.id])
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    const valid = await bcrypt.compare(current_password, user.password)
    if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    const hashed = await bcrypt.hash(new_password, 10)
    await db.runAsync('UPDATE users SET password=? WHERE id=?', [hashed, user.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
