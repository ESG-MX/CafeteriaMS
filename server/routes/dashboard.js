const express = require('express')
const router  = express.Router()
const db      = require('../db')
const { auth, scopeClient } = require('../middleware/auth')

const useSQLite = !process.env.DB_CONNECTION_STRING || process.env.USE_SQLITE === 'true'

// SQL helpers — SQLite vs Azure SQL
const sql = useSQLite ? {
  today:     `DATE(p.created_at) = DATE('now')`,
  weekStart: `DATE(p.created_at) >= DATE('now', 'weekday 1', '-6 days')`,
  thisMonth: `strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now')`,
  ifnull:    (col) => `IFNULL(${col}, 0)`,
  top:       (n)   => `LIMIT ${n}`,
  topPrefix: '',
} : {
  today:     `CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)`,
  weekStart: `CAST(created_at AS DATE) >= DATEADD(WEEK, DATEDIFF(WEEK,0,GETDATE()), 0)`,
  thisMonth: `YEAR(created_at)=YEAR(GETDATE()) AND MONTH(created_at)=MONTH(GETDATE())`,
  ifnull:    (col) => `ISNULL(${col}, 0)`,
  top:       (n)   => ``,
  topPrefix: 'TOP 8',
}

router.get('/', auth, async (req, res) => {
  try {
    const clientId       = scopeClient(req)
    const filterClientId = clientId ?? (req.query.client_id ? Number(req.query.client_id) : null)

    const cond = filterClientId ? ' AND p.client_id=?' : ''
    const args = filterClientId ? [filterClientId] : []

    const [today, week, month, byService, byClient, recent] = await Promise.all([
      db.getAsync(
        `SELECT COUNT(*) as count, ${sql.ifnull('SUM(price)')} as total
         FROM purchases p WHERE status='approved' AND ${sql.today}${cond}`, args),

      db.getAsync(
        `SELECT COUNT(*) as count, ${sql.ifnull('SUM(price)')} as total
         FROM purchases p WHERE status='approved' AND ${sql.weekStart}${cond}`, args),

      db.getAsync(
        `SELECT COUNT(*) as count, ${sql.ifnull('SUM(price)')} as total
         FROM purchases p WHERE status='approved' AND ${sql.thisMonth}${cond}`, args),

      db.allAsync(
        `SELECT p.service_name, COUNT(*) as count, ${sql.ifnull('SUM(p.price)')} as total
         FROM purchases p WHERE status='approved' AND ${sql.today}${cond}
         GROUP BY p.service_name ORDER BY total DESC`, args),

      clientId
        ? Promise.resolve([])
        : db.allAsync(
          `SELECT c.name as client_name, COUNT(*) as count, ${sql.ifnull('SUM(p.price)')} as total
           FROM purchases p LEFT JOIN clients c ON p.client_id=c.id
           WHERE p.status='approved' AND ${sql.today}
           GROUP BY c.name ORDER BY total DESC`, []),

      db.allAsync(
        `SELECT ${sql.topPrefix} p.created_at, p.employee_name, p.employee_number,
           p.service_name, p.price, c.name as client_name
         FROM purchases p LEFT JOIN clients c ON p.client_id=c.id
         WHERE p.status='approved'${cond}
         ORDER BY p.created_at DESC ${sql.top(8)}`, args),
    ])

    res.json({ today, week, month, byService, byClient, recent })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
