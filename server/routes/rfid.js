const express   = require('express');
const router    = express.Router();
const db        = require('../db');
const { broadcast } = require('../ws');
const { auth }  = require('../middleware/auth');

router.use(auth); // Requiere sesión activa — el operador siempre está logueado

// Resuelve el empleado según el método usado, restringido a la empresa del scanner
async function resolveEmployee(method, identifier, clientId) {
  switch (method) {
    case 'rfid': {
      const card = await db.getAsync(
        'SELECT * FROM rfid_cards WHERE rfid_code=? AND active=1', [identifier]
      )
      if (!card) return { error: 'Tarjeta RFID no registrada o inactiva' }
      const emp = await db.getAsync(
        'SELECT * FROM employees WHERE id=? AND client_id=? AND active=1',
        [card.employee_id, clientId]
      )
      if (!emp) return { error: 'Tarjeta no pertenece a esta empresa' }
      return { employee: emp, identifier }
    }
    case 'employee_number': {
      const emp = await db.getAsync(
        'SELECT * FROM employees WHERE employee_number=? AND client_id=? AND active=1',
        [identifier, clientId]
      )
      if (!emp) return { error: 'Número de empleado no encontrado en esta empresa' }
      return { employee: emp, identifier }
    }
    case 'biometric': {
      const emp = await db.getAsync(
        'SELECT * FROM employees WHERE biometric_id=? AND client_id=? AND active=1',
        [identifier, clientId]
      )
      if (!emp) return { error: 'Huella biométrica no registrada en esta empresa' }
      return { employee: emp, identifier }
    }
    default:
      return { error: 'Método de cobro no válido' }
  }
}

router.post('/scan', async (req, res) => {
  const { identifier, method = 'rfid', service_type_id, client_id } = req.body

  if (!identifier) return res.status(400).json({ error: 'Identificador requerido' })
  if (!method)     return res.status(400).json({ error: 'Método requerido' })
  if (!client_id)  return res.status(400).json({ error: 'Empresa requerida' })

  // Seguridad: scanner y admin_empresa solo pueden operar en su propia empresa
  if (req.user.role !== 'super_admin' && req.user.client_id !== Number(client_id))
    return res.status(403).json({ error: 'No tienes acceso a esta empresa' })

  try {
    // 1. Resolver empleado — solo dentro de la empresa del scanner
    const { employee, error: empError, identifier: resolvedId } = await resolveEmployee(method, identifier, client_id)
    if (empError)  return res.json({ status: 'rejected', reason: empError })
    if (!employee || !employee.active) return res.json({ status: 'rejected', reason: 'Empleado inactivo' })

    // 2. Verificar que el método esté habilitado para la empresa del empleado
    const methodRow = await db.getAsync(
      'SELECT enabled FROM client_scan_methods WHERE client_id=? AND method=?',
      [employee.client_id, method]
    )
    if (!methodRow || !methodRow.enabled)
      return res.json({ status: 'rejected', reason: `El método "${method}" no está habilitado para esta empresa` })

    // 3. Determinar servicio
    let serviceId = service_type_id
    if (!serviceId) {
      const clientRow = await db.getAsync('SELECT timezone_offset FROM clients WHERE id=?', [client_id])
      const TZ_OFFSET_MS = (clientRow?.timezone_offset ?? -6) * 60 * 60 * 1000
      const now = new Date(Date.now() + TZ_OFFSET_MS)
      const dayOfWeek = now.getUTCDay()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const timeStr = `${h}:${m}`
      const available = await db.getAsync(`
        SELECT cs.service_type_id FROM client_services cs
        JOIN service_types st ON cs.service_type_id = st.id
        JOIN schedules sch ON sch.service_type_id = cs.service_type_id
        WHERE cs.client_id=? AND cs.active=1 AND st.active=1
          AND sch.active=1 AND sch.day_of_week=?
          AND sch.start_time <= ? AND sch.end_time >= ?`,
        [employee.client_id, dayOfWeek, timeStr, timeStr]
      )
      if (!available) return res.json({ status: 'rejected', reason: 'No hay servicio disponible en este horario' })
      serviceId = available.service_type_id
    }

    const service = await db.getAsync('SELECT * FROM service_types WHERE id=? AND active=1', [serviceId])
    if (!service) return res.json({ status: 'rejected', reason: 'Servicio no válido' })

    const clientService = await db.getAsync(
      'SELECT * FROM client_services WHERE client_id=? AND service_type_id=? AND active=1',
      [employee.client_id, serviceId]
    )
    if (!clientService) return res.json({ status: 'rejected', reason: 'La empresa no tiene este servicio contratado' })

    // 4. Anti-duplicado (60 segundos)
    const recent = await db.getAsync(`
      SELECT id FROM purchases
      WHERE employee_id=? AND service_type_id=? AND status='approved'
        AND created_at >= DATEADD(SECOND, -60, GETDATE())`,
      [employee.id, serviceId]
    )
    if (recent) return res.json({ status: 'rejected', reason: 'Compra duplicada (espera 60 segundos)' })

    // 5. Verificar acceso individual del empleado al servicio
    const serviceAccess = await db.getAsync(
      'SELECT * FROM employee_service_access WHERE employee_id=? AND service_type_id=?',
      [employee.id, serviceId]
    )
    // Si existe un registro con enabled=0, el servicio está bloqueado para este empleado
    if (serviceAccess && serviceAccess.enabled === 0)
      return res.json({ status: 'rejected', reason: 'Servicio no autorizado para este empleado' })

    // Límites: del registro individual. 0 = sin límite
    const dailyLimit  = serviceAccess?.daily_limit  ?? 0
    const weeklyLimit = serviceAccess?.weekly_limit ?? 0

    // 6. Límite diario
    const today = new Date().toISOString().slice(0, 10)
    const { cnt: dailyCount } = await db.getAsync(`
      SELECT COUNT(*) as cnt FROM purchases
      WHERE employee_id=? AND service_type_id=? AND status='approved'
        AND CAST(created_at AS DATE) = CAST(? AS DATE)`,
      [employee.id, serviceId, today]
    )
    if (dailyLimit > 0 && dailyCount >= dailyLimit)
      return res.json({ status: 'rejected', reason: `Límite diario alcanzado (${dailyLimit})` })

    // 7. Límite semanal
    const { cnt: weeklyCount } = await db.getAsync(`
      SELECT COUNT(*) as cnt FROM purchases
      WHERE employee_id=? AND service_type_id=? AND status='approved'
        AND CAST(created_at AS DATE) >= DATEADD(WEEK, DATEDIFF(WEEK, 0, GETDATE()), 0)`,
      [employee.id, serviceId]
    )
    if (weeklyLimit > 0 && weeklyCount >= weeklyLimit)
      return res.json({ status: 'rejected', reason: `Límite semanal alcanzado (${weeklyLimit})` })

    // 7. Registrar compra (client_name denormalizado para proteger historial)
    const clientRow = await db.getAsync('SELECT name FROM clients WHERE id=?', [employee.client_id])
    const r = await db.runAsync(`
      INSERT INTO purchases
        (rfid_code, employee_id, employee_name, employee_number, client_id, client_name, service_type_id, service_name, price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
      [resolvedId, employee.id, employee.name, employee.employee_number,
       employee.client_id, clientRow?.name || null, serviceId, service.name, service.price]
    )

    const result = {
      status: 'approved',
      purchase_id: r.lastID,
      employee_name: employee.name,
      employee_number: employee.employee_number,
      service_name: service.name,
      price: service.price,
      client_id: employee.client_id,
      method,
      timestamp: new Date().toISOString()
    }

    broadcast({ type: 'purchase', data: result })
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
