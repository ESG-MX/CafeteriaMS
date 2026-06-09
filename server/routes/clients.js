const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { auth, adminOnly, scopeClient } = require('../middleware/auth');

// Público — solo id y nombre para el dropdown del login
// Los datos completos (RFC, contacto, etc.) requieren token en GET /:id
router.get('/', async (req, res) => {
  try {
    const rows = await db.allAsync('SELECT id, name, active FROM clients WHERE active=1 ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    // admin_empresa solo puede ver su propia empresa
    const clientId = scopeClient(req);
    if (clientId && Number(req.params.id) !== Number(clientId))
      return res.status(403).json({ error: 'Sin acceso a esta empresa' });
    const client = await db.getAsync('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    const services = await db.allAsync(`
      SELECT cs.*, st.name as service_name, st.price as service_price,
             st.description as service_description, st.active as service_active
      FROM client_services cs
      JOIN service_types st ON cs.service_type_id = st.id
      WHERE cs.client_id = ? AND cs.active=1`, [req.params.id]);
    res.json({ ...client, services });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
  const { name, rfc, contact, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const r = await db.runAsync(
      'INSERT INTO clients (name, rfc, contact, phone, email) VALUES (?, ?, ?, ?, ?)',
      [name, rfc || null, contact || null, phone || null, email || null]
    );
    // Número de empleado habilitado por default en cada empresa nueva
    await db.runAsync(
      `IF NOT EXISTS (SELECT 1 FROM client_scan_methods WHERE client_id=? AND method='employee_number')
         INSERT INTO client_scan_methods (client_id, method, enabled) VALUES (?, 'employee_number', 1)`,
      [r.lastID, r.lastID]
    );
    res.json({ id: r.lastID, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  const { name, rfc, contact, phone, email, active } = req.body;
  try {
    await db.runAsync(
      'UPDATE clients SET name=?, rfc=?, contact=?, phone=?, email=?, active=? WHERE id=?',
      [name, rfc, contact, phone, email, active ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  await db.runAsync('UPDATE clients SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/services', auth, adminOnly, async (req, res) => {
  const { service_type_id, daily_limit, weekly_limit } = req.body;
  try {
    const r = await db.runAsync(
      `MERGE INTO client_services AS t
       USING (SELECT ? AS client_id, ? AS service_type_id,
                     ? AS daily_limit, ? AS weekly_limit) AS s
       ON t.client_id = s.client_id AND t.service_type_id = s.service_type_id
       WHEN MATCHED THEN
         UPDATE SET daily_limit = s.daily_limit, weekly_limit = s.weekly_limit, active = 1
       WHEN NOT MATCHED THEN
         INSERT (client_id, service_type_id, daily_limit, weekly_limit)
         VALUES (s.client_id, s.service_type_id, s.daily_limit, s.weekly_limit)
       OUTPUT INSERTED.id AS lastID;`,
      [req.params.id, service_type_id, daily_limit || 0, weekly_limit || 0]
    );
    res.json({ id: r.lastID });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/:id/services/:sid', auth, adminOnly, async (req, res) => {
  await db.runAsync('DELETE FROM client_services WHERE client_id=? AND service_type_id=?', [req.params.id, req.params.sid]);
  res.json({ ok: true });
});

// ── Configuración general de empresa ─────────────────────────────
router.put('/:id/settings', auth, adminOnly, async (req, res) => {
  const { silent_print, timezone_offset } = req.body
  if (silent_print === undefined && timezone_offset === undefined)
    return res.status(400).json({ error: 'Se requiere al menos un campo: silent_print, timezone_offset' })
  try {
    if (silent_print !== undefined)
      await db.runAsync('UPDATE clients SET silent_print=? WHERE id=?', [silent_print ? 1 : 0, req.params.id])
    if (timezone_offset !== undefined)
      await db.runAsync('UPDATE clients SET timezone_offset=? WHERE id=?', [Number(timezone_offset), req.params.id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Métodos de cobro ──────────────────────────────────────────────
const ALL_METHODS = [
  { key: 'rfid',            label: 'RFID / Tarjeta',      icon: '📡' },
  { key: 'employee_number', label: 'Número de Empleado',   icon: '🔢' },
  { key: 'biometric',       label: 'Biométrico',           icon: '👆' },
]

// GET métodos de una empresa — devuelve los 3 siempre con su estado
router.get('/:id/scan-methods', auth, async (req, res) => {
  try {
    const rows = await db.allAsync(
      'SELECT method, enabled FROM client_scan_methods WHERE client_id=?',
      [req.params.id]
    )
    const map = Object.fromEntries(rows.map(r => [r.method, r.enabled]))
    const result = ALL_METHODS.map(m => ({
      ...m,
      enabled: map[m.key] ?? 0
    }))
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// PUT habilitar/deshabilitar un método
router.put('/:id/scan-methods/:method', auth, adminOnly, async (req, res) => {
  const { enabled } = req.body
  const validMethods = ALL_METHODS.map(m => m.key)
  if (!validMethods.includes(req.params.method))
    return res.status(400).json({ error: 'Método inválido' })
  try {
    await db.runAsync(
      `MERGE INTO client_scan_methods AS t
       USING (SELECT ? AS client_id, ? AS method, ? AS enabled) AS s
       ON t.client_id = s.client_id AND t.method = s.method
       WHEN MATCHED THEN UPDATE SET enabled = s.enabled
       WHEN NOT MATCHED THEN INSERT (client_id, method, enabled)
         VALUES (s.client_id, s.method, s.enabled);`,
      [req.params.id, req.params.method, enabled ? 1 : 0]
    )
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router;
