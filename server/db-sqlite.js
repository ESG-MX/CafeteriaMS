/**
 * SQLite adapter using Node.js built-in `node:sqlite` (available since Node 22.5+)
 * Same API as db.js: init / runAsync / getAsync / allAsync
 * Used automatically when DB_CONNECTION_STRING is not set.
 */

const path   = require('path');
const bcrypt = require('bcrypt');

let db = null;

async function init() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    throw new Error(
      'node:sqlite no está disponible.\n' +
      'Requiere Node.js 22.5 o superior.\n' +
      'Versión actual: ' + process.version
    );
  }

  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'cafeteria.db');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  console.log(`✅ Conectado a SQLite: ${dbPath}`);
  await createTables();
  console.log('✅ Tablas verificadas/creadas');
}

/* ── Async wrappers (node:sqlite es síncrono) ─────────────────────── */
async function runAsync(query, params = []) {
  const stmt   = db.prepare(query);
  const result = stmt.run(...params);
  return { lastID: result.lastInsertRowid ?? null };
}

async function getAsync(query, params = []) {
  return db.prepare(query).get(...params) ?? null;
}

async function allAsync(query, params = []) {
  return db.prepare(query).all(...params);
}

/* ── Schema SQLite ────────────────────────────────────────────────── */
async function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL UNIQUE,
      rfc             TEXT,
      contact         TEXT,
      phone           TEXT,
      email           TEXT,
      active          INTEGER DEFAULT 1,
      silent_print    INTEGER NOT NULL DEFAULT 1,
      timezone_offset INTEGER NOT NULL DEFAULT -6,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_types (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL DEFAULT 0,
      active      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_services (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id       INTEGER NOT NULL REFERENCES clients(id),
      service_type_id INTEGER NOT NULL REFERENCES service_types(id),
      daily_limit     INTEGER DEFAULT 0,
      weekly_limit    INTEGER DEFAULT 0,
      active          INTEGER DEFAULT 1,
      UNIQUE (client_id, service_type_id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT NOT NULL,
      name            TEXT,
      email           TEXT,
      department      TEXT,
      position        TEXT,
      biometric_id    TEXT,
      client_id       INTEGER REFERENCES clients(id),
      active          INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE (employee_number, client_id)
    );

    CREATE TABLE IF NOT EXISTS rfid_cards (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      rfid_code     TEXT UNIQUE NOT NULL,
      employee_id   INTEGER REFERENCES employees(id),
      assigned_at   TEXT DEFAULT (datetime('now')),
      unassigned_at TEXT,
      active        INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      rfid_code        TEXT NOT NULL,
      employee_id      INTEGER,
      employee_name    TEXT,
      employee_number  TEXT,
      client_id        INTEGER,
      client_name      TEXT,
      service_type_id  INTEGER REFERENCES service_types(id),
      service_name     TEXT,
      price            REAL NOT NULL DEFAULT 0,
      status           TEXT DEFAULT 'approved',
      rejection_reason TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      service_type_id INTEGER NOT NULL REFERENCES service_types(id),
      day_of_week     INTEGER NOT NULL,
      start_time      TEXT NOT NULL,
      end_time        TEXT NOT NULL,
      active          INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS employee_service_access (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id     INTEGER NOT NULL REFERENCES employees(id),
      service_type_id INTEGER NOT NULL REFERENCES service_types(id),
      enabled         INTEGER NOT NULL DEFAULT 1,
      daily_limit     INTEGER NOT NULL DEFAULT 0,
      weekly_limit    INTEGER NOT NULL DEFAULT 0,
      UNIQUE (employee_id, service_type_id)
    );

    CREATE TABLE IF NOT EXISTS client_scan_methods (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      method    TEXT NOT NULL CHECK(method IN ('rfid','employee_number','biometric')),
      enabled   INTEGER DEFAULT 0,
      UNIQUE (client_id, method)
    );

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('super_admin','admin_empresa','scanner')),
      client_id  INTEGER REFERENCES clients(id),
      active     INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed demo companies
  ['Demo Company A', 'Demo Company B', 'Demo Company C'].forEach(name => {
    db.prepare(`INSERT OR IGNORE INTO clients (name) VALUES (?)`).run(name);
  });

  // Seed scan methods
  ['Demo Company A', 'Demo Company B', 'Demo Company C'].forEach(name => {
    db.prepare(`
      INSERT OR IGNORE INTO client_scan_methods (client_id, method, enabled)
      VALUES ((SELECT id FROM clients WHERE name=?), 'employee_number', 1)
    `).run(name);
  });

  // Seed service types
  [
    ['Desayuno', 'Breakfast service', 25],
    ['Comida',   'Lunch service',     45],
    ['Cena',     'Dinner service',    35],
  ].forEach(([name, desc, price]) => {
    db.prepare(`INSERT OR IGNORE INTO service_types (name, description, price) VALUES (?, ?, ?)`)
      .run(name, desc, price);
  });

  // Seed super_admin
  const existing = db.prepare(`SELECT id FROM users WHERE username='admin'`).get();
  if (!existing) {
    const hashed = await bcrypt.hash('admin123', 10);
    db.prepare(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', ?, 'super_admin')`).run(hashed);
  }

  // Seed company admins
  const plainPass = await bcrypt.hash('admin123', 10);
  [
    ['Admin_CompanyA', 'Demo Company A'],
    ['Admin_CompanyB', 'Demo Company B'],
    ['Admin_CompanyC', 'Demo Company C'],
  ].forEach(([u, company]) => {
    db.prepare(`
      INSERT OR IGNORE INTO users (username, password, role, client_id)
      VALUES (?, ?, 'admin_empresa', (SELECT id FROM clients WHERE name=?))
    `).run(u, plainPass, company);
  });

  // Migrate plain-text passwords to bcrypt
  const plainUsers = db.prepare(`SELECT id, password FROM users WHERE password NOT LIKE '$2b$%'`).all();
  for (const u of plainUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed, u.id);
  }
  if (plainUsers.length > 0)
    console.log(`✅ ${plainUsers.length} contraseña(s) migradas a bcrypt`);
}

module.exports = { init, runAsync, getAsync, allAsync };
