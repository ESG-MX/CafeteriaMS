const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX   = require('xlsx');
const db     = require('../db');
const { auth, scopeClient } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv']
    const ext = require('path').extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Solo se permiten archivos .xlsx, .xls o .csv'))
  }
});

// Todos los endpoints de empleados requieren autenticación
router.use(auth);

// ── Descargar plantilla Excel para carga masiva ───────────────────
router.get('/template', (req, res) => {
  const wb = XLSX.utils.book_new();

  // Datos de ejemplo para que el cliente sepa cómo llenar
  const data = [
    { Numero: 'EMP-001', Nombre: 'Juan Pérez',   Email: 'juan@empresa.com',  Departamento: 'Producción',     Puesto: 'Operador'  },
    { Numero: 'EMP-002', Nombre: 'María García',  Email: 'maria@empresa.com', Departamento: 'Administración', Puesto: 'Analista'  },
    { Numero: 'EMP-003', Nombre: 'Carlos López',  Email: '',                  Departamento: 'Logística',      Puesto: 'Supervisor'},
  ];

  const ws = XLSX.utils.json_to_sheet(data);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 15 }, // Numero
    { wch: 25 }, // Nombre
    { wch: 30 }, // Email
    { wch: 22 }, // Departamento
    { wch: 22 }, // Puesto
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_empleados.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ── Empleados + acceso a servicios en una sola consulta (evita N+1) ─
router.get('/with-services', async (req, res) => {
  const clientId = scopeClient(req) || req.query.client_id;
  if (!clientId) return res.status(400).json({ error: 'client_id requerido' });
  try {
    const employees = await db.allAsync(
      `SELECT id, employee_number, name FROM employees WHERE client_id=? AND active=1 ORDER BY name`,
      [clientId]
    );
    const access = await db.allAsync(
      `SELECT esa.employee_id, esa.service_type_id, esa.enabled, esa.daily_limit, esa.weekly_limit
       FROM employee_service_access esa
       JOIN employees e ON esa.employee_id = e.id
       WHERE e.client_id=?`,
      [clientId]
    );
    // Indexar acceso por employee_id
    const accessMap = {};
    for (const row of access) {
      if (!accessMap[row.employee_id]) accessMap[row.employee_id] = [];
      accessMap[row.employee_id].push(row);
    }
    const result = employees.map(e => ({ ...e, services: accessMap[e.id] || [] }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  const clientId = scopeClient(req);
  let q = `SELECT e.*, c.name as client_name, r.rfid_code
           FROM employees e
           LEFT JOIN clients c ON e.client_id = c.id
           LEFT JOIN rfid_cards r ON r.employee_id = e.id AND r.active = 1`;
  const params = [];
  if (clientId) { q += ' WHERE e.client_id = ?'; params.push(clientId); }
  q += ' ORDER BY e.name';
  try {
    res.json(await db.allAsync(q, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Descargar plantilla de servicios con empleados y estado actual ─
router.get('/services-template', async (req, res) => {
  const clientId = scopeClient(req) || req.query.client_id;
  if (!clientId) return res.status(400).json({ error: 'Cliente requerido' });
  try {
    const employees = await db.allAsync(
      'SELECT id, employee_number, name FROM employees WHERE client_id=? AND active=1 ORDER BY name',
      [clientId]
    );
    const services = await db.allAsync(
      `SELECT st.id, st.name FROM service_types st
       JOIN client_services cs ON cs.service_type_id = st.id
       WHERE cs.client_id=? AND cs.active=1 AND st.active=1 ORDER BY st.id`,
      [clientId]
    );
    const accessRows = await db.allAsync(
      `SELECT esa.* FROM employee_service_access esa
       JOIN employees e ON esa.employee_id = e.id
       WHERE e.client_id=?`, [clientId]
    );
    const accessMap = {};
    for (const row of accessRows) {
      if (!accessMap[row.employee_id]) accessMap[row.employee_id] = {};
      accessMap[row.employee_id][row.service_type_id] = row;
    }

    const data = employees.map(emp => {
      const row = { Numero: emp.employee_number, Nombre: emp.name || '' };
      for (const svc of services) {
        const acc = accessMap[emp.id]?.[svc.id];
        row[svc.name]                      = acc ? (acc.enabled ? 'SI' : 'NO') : 'SI';
        row[`${svc.name}_LimiteDia`]       = acc?.daily_limit  ?? 0;
        row[`${svc.name}_LimiteSemana`]    = acc?.weekly_limit ?? 0;
      }
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    const cols = [{ wch: 15 }, { wch: 25 }];
    services.forEach(() => { cols.push({ wch: 14 }, { wch: 13 }, { wch: 15 }); });
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="servicios_empleados.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const emp = await db.getAsync(`
      SELECT e.*, c.name as client_name
      FROM employees e LEFT JOIN clients c ON e.client_id = c.id
      WHERE e.id = ?`, [req.params.id]);
    if (!emp) return res.status(404).json({ error: 'Empleado no encontrado' });
    // Verificar que el empleado pertenece a la empresa del usuario
    const clientId = scopeClient(req);
    if (clientId && emp.client_id !== Number(clientId))
      return res.status(403).json({ error: 'Sin acceso a este empleado' });
    emp.rfid_cards = await db.allAsync('SELECT * FROM rfid_cards WHERE employee_id = ? ORDER BY assigned_at DESC', [emp.id]);
    emp.services = await db.allAsync(`
      SELECT esa.*, st.name as service_name
      FROM employee_service_access esa
      JOIN service_types st ON esa.service_type_id = st.id
      WHERE esa.employee_id = ?`, [emp.id]);
    res.json(emp);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { employee_number, name, email, department, position } = req.body;
  // client_id siempre del token (no del body) — previene spoofing
  const clientId = scopeClient(req) || req.body.client_id;
  if (!employee_number || !clientId) return res.status(400).json({ error: 'Número de empleado y cliente requeridos' });
  try {
    const r = await db.runAsync(
      'INSERT INTO employees (employee_number, name, email, department, position, client_id) VALUES (?, ?, ?, ?, ?, ?)',
      [employee_number, name || null, email || null, department || null, position || null, clientId]
    );
    res.json({ id: r.lastID });
  } catch (e) { res.status(400).json({ error: 'Número de empleado ya existe para este cliente' }); }
});

router.put('/:id', async (req, res) => {
  const { employee_number, name, email, department, position, active } = req.body;
  // Forzar client_id del token — no se puede reasignar un empleado a otra empresa
  const clientId = scopeClient(req) || req.body.client_id;
  try {
    await db.runAsync(
      'UPDATE employees SET employee_number=?, name=?, email=?, department=?, position=?, client_id=?, active=? WHERE id=?',
      [employee_number, name, email, department, position, clientId, active ?? 1, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/rfid', async (req, res) => {
  const { rfid_code } = req.body;
  if (!rfid_code) return res.status(400).json({ error: 'Código RFID requerido' });
  try {
    await db.runAsync('UPDATE rfid_cards SET active=0, unassigned_at=CURRENT_TIMESTAMP WHERE employee_id=? AND active=1', [req.params.id]);
    await db.runAsync('UPDATE rfid_cards SET active=0, unassigned_at=CURRENT_TIMESTAMP WHERE rfid_code=? AND active=1', [rfid_code]);
    await db.runAsync('INSERT INTO rfid_cards (rfid_code, employee_id) VALUES (?, ?)', [rfid_code, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Acceso individual a servicios (reemplaza /limits) ────────────
router.put('/:id/services', async (req, res) => {
  // body: [{ service_type_id, enabled, daily_limit, weekly_limit }, ...]
  const entries = Array.isArray(req.body) ? req.body : [req.body];
  try {
    for (const { service_type_id, enabled = 1, daily_limit = 0, weekly_limit = 0 } of entries) {
      await db.runAsync(
        `MERGE INTO employee_service_access AS t
         USING (SELECT ? AS employee_id, ? AS service_type_id,
                       ? AS enabled, ? AS daily_limit, ? AS weekly_limit) AS s
         ON t.employee_id = s.employee_id AND t.service_type_id = s.service_type_id
         WHEN MATCHED THEN
           UPDATE SET enabled=s.enabled, daily_limit=s.daily_limit, weekly_limit=s.weekly_limit
         WHEN NOT MATCHED THEN
           INSERT (employee_id,service_type_id,enabled,daily_limit,weekly_limit)
           VALUES (s.employee_id,s.service_type_id,s.enabled,s.daily_limit,s.weekly_limit);`,
        [req.params.id, service_type_id, enabled ? 1 : 0, daily_limit || 0, weekly_limit || 0]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Carga masiva de acceso a servicios ───────────────────────────
router.post('/services/bulk', async (req, res) => {
  // body: [{ employee_id, service_type_id, enabled, daily_limit, weekly_limit }]
  const entries = Array.isArray(req.body) ? req.body : [];
  try {
    for (const { employee_id, service_type_id, enabled = 1, daily_limit = 0, weekly_limit = 0 } of entries) {
      await db.runAsync(
        `MERGE INTO employee_service_access AS t
         USING (SELECT ? AS employee_id, ? AS service_type_id,
                       ? AS enabled, ? AS daily_limit, ? AS weekly_limit) AS s
         ON t.employee_id = s.employee_id AND t.service_type_id = s.service_type_id
         WHEN MATCHED THEN
           UPDATE SET enabled=s.enabled, daily_limit=s.daily_limit, weekly_limit=s.weekly_limit
         WHEN NOT MATCHED THEN
           INSERT (employee_id,service_type_id,enabled,daily_limit,weekly_limit)
           VALUES (s.employee_id,s.service_type_id,s.enabled,s.daily_limit,s.weekly_limit);`,
        [employee_id, service_type_id, enabled ? 1 : 0, daily_limit || 0, weekly_limit || 0]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Subir Excel de servicios ──────────────────────────────────────
router.post('/services-bulk-upload', upload.single('file'), async (req, res) => {
  const clientId = scopeClient(req) || req.body.client_id;
  if (!clientId) return res.status(400).json({ error: 'Cliente requerido' });
  if (!req.file)  return res.status(400).json({ error: 'Archivo requerido' });
  try {
    const services = await db.allAsync(
      `SELECT st.id, st.name FROM service_types st
       JOIN client_services cs ON cs.service_type_id = st.id
       WHERE cs.client_id=? AND cs.active=1 AND st.active=1`, [clientId]
    );
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    let updated = 0; const errors = [];

    for (const row of rows) {
      const empNum = String(row['Numero'] || '').trim();
      if (!empNum) continue;
      const emp = await db.getAsync(
        'SELECT id FROM employees WHERE employee_number=? AND client_id=? AND active=1',
        [empNum, clientId]
      );
      if (!emp) { errors.push(`Empleado ${empNum} no encontrado`); continue; }

      for (const svc of services) {
        const val     = String(row[svc.name] || 'SI').trim().toUpperCase();
        const enabled = val === 'SI' || val === '1' || val === 'TRUE' ? 1 : 0;
        const daily   = parseInt(row[`${svc.name}_LimiteDia`])   || 0;
        const weekly  = parseInt(row[`${svc.name}_LimiteSemana`]) || 0;
        await db.runAsync(
          `MERGE INTO employee_service_access AS t
           USING (SELECT ? AS employee_id, ? AS service_type_id,
                         ? AS enabled, ? AS daily_limit, ? AS weekly_limit) AS s
           ON t.employee_id = s.employee_id AND t.service_type_id = s.service_type_id
           WHEN MATCHED THEN
             UPDATE SET enabled=s.enabled, daily_limit=s.daily_limit, weekly_limit=s.weekly_limit
           WHEN NOT MATCHED THEN
             INSERT (employee_id,service_type_id,enabled,daily_limit,weekly_limit)
             VALUES (s.employee_id,s.service_type_id,s.enabled,s.daily_limit,s.weekly_limit);`,
          [emp.id, svc.id, enabled, daily, weekly]
        );
      }
      updated++;
    }
    res.json({ updated, errors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  const client_id = scopeClient(req) || req.body.client_id;
  if (!client_id) return res.status(400).json({ error: 'Cliente requerido' });
  if (!req.file)  return res.status(400).json({ error: 'Archivo requerido' });

  // mode=upsert → solo agregar/actualizar (seguro para tandas, default)
  // mode=replace → dar de baja a los que no estén en el archivo (lista completa)
  const mode = req.body.mode === 'replace' ? 'replace' : 'upsert';

  const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const results = { created: 0, updated: 0, deactivated: 0, mode, errors: [] };
  const uploadedNumbers = new Set();

  try {
    for (const row of rows) {
      const empNum = String(row['Numero'] || row['NumeroEmpleado'] || row['numero_empleado'] || row['employee_number'] || '').trim();
      if (!empNum) { results.errors.push('Fila sin número de empleado'); continue; }
      uploadedNumbers.add(empNum);

      const name       = String(row['Nombre']       || row['nombre']       || row['name']        || '').trim() || null;
      const email      = String(row['Email']        || row['email']        || row['correo']      || '').trim() || null;
      const department = String(row['Departamento'] || row['departamento'] || row['department']  || '').trim() || null;
      const position   = String(row['Puesto']       || row['puesto']       || row['position']    || '').trim() || null;

      const existing = await db.getAsync(
        'SELECT id FROM employees WHERE employee_number=? AND client_id=?',
        [empNum, client_id]
      );
      if (existing) {
        await db.runAsync(
          'UPDATE employees SET name=?, email=?, department=?, position=?, active=1 WHERE id=?',
          [name, email, department, position, existing.id]
        );
        results.updated++;
      } else {
        try {
          await db.runAsync(
            'INSERT INTO employees (employee_number, name, email, department, position, client_id) VALUES (?, ?, ?, ?, ?, ?)',
            [empNum, name, email, department, position, client_id]
          );
          results.created++;
        } catch (e) { results.errors.push(`Error en empleado ${empNum}: ${e.message}`); }
      }
    }

    // Solo en modo replace: dar de baja a los que no estén en el archivo
    if (mode === 'replace') {
      const active = await db.allAsync(
        'SELECT id, employee_number FROM employees WHERE client_id=? AND active=1',
        [client_id]
      );
      for (const emp of active) {
        if (!uploadedNumbers.has(emp.employee_number)) {
          await db.runAsync('UPDATE employees SET active=0 WHERE id=?', [emp.id]);
          results.deactivated++;
        }
      }
    }

    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
