const express = require('express');
const router = express.Router();
const db = require('../db');

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

router.get('/', async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT s.*, st.name as service_name
      FROM schedules s JOIN service_types st ON s.service_type_id = st.id
      ORDER BY s.service_type_id, s.day_of_week`);
    res.json(rows.map(r => ({ ...r, day_name: DAYS[r.day_of_week] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { service_type_id, day_of_week, start_time, end_time } = req.body;
  if (service_type_id == null || day_of_week == null || !start_time || !end_time)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  try {
    const r = await db.runAsync(
      'INSERT INTO schedules (service_type_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
      [service_type_id, day_of_week, start_time, end_time]
    );
    res.json({ id: r.lastID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { service_type_id, day_of_week, start_time, end_time, active } = req.body;
  try {
    await db.runAsync(
      'UPDATE schedules SET service_type_id=?, day_of_week=?, start_time=?, end_time=?, active=? WHERE id=?',
      [service_type_id, day_of_week, start_time, end_time, active ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  await db.runAsync('DELETE FROM schedules WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
