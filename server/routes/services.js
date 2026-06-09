const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const rows = await db.allAsync('SELECT * FROM service_types ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, description, price } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Nombre y precio requeridos' });
  try {
    const r = await db.runAsync(
      'INSERT INTO service_types (name, description, price) VALUES (?, ?, ?)',
      [name, description || null, price]
    );
    res.json({ id: r.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { name, description, price, active } = req.body;
  try {
    await db.runAsync(
      'UPDATE service_types SET name=?, description=?, price=?, active=? WHERE id=?',
      [name, description, price, active ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  await db.runAsync('UPDATE service_types SET active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
