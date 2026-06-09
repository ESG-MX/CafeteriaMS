// Switch to SQLite for local demo when DB_CONNECTION_STRING is not set
if (!process.env.DB_CONNECTION_STRING || process.env.USE_SQLITE === 'true') {
  module.exports = require('./db-sqlite');
  return; // valid in Node.js CommonJS (modules are wrapped in a function)
}

const sql    = require('mssql');
const bcrypt = require('bcrypt');

let pool = null;

/* ──────────────────────────────────────────────
   Parsea el connection string ADO.NET de Azure Portal.
   Formato:
     Server=tcp:bd-sdc.database.windows.net,1433;
     Initial Catalog=SistemaDeComensales;
     User ID=admin_sdc;Password=***;Encrypt=True;...
────────────────────────────────────────────── */
function parseConnectionString(connStr) {
  const obj = {};
  connStr.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim().toLowerCase();
    const val = pair.slice(idx + 1).trim();
    if (key) obj[key] = val;
  });
  const serverRaw   = obj['server'] || obj['data source'] || '';
  const serverClean = serverRaw.replace(/^tcp:/i, '');
  const [host, portStr] = serverClean.split(',');
  return {
    server:   host.trim(),
    port:     portStr ? parseInt(portStr.trim(), 10) : 1433,
    database: obj['initial catalog'] || obj['database'] || '',
    user:     obj['user id'] || obj['uid'] || obj['user'] || '',
    password: obj['password'] || obj['pwd'] || '',
    options: {
      encrypt:                true,
      trustServerCertificate: false,
      connectTimeout:         30000,
      requestTimeout:         30000,
    },
  };
}

/* Convierte ? → @p0, @p1… (SQLite usa ? ; mssql usa parámetros nombrados) */
function convertParams(query) {
  let i = 0;
  return query.replace(/\?/g, () => `@p${i++}`);
}

/* INSERT/UPDATE/DELETE → { lastID } */
async function runAsync(query, params = []) {
  const q        = convertParams(query);
  const isInsert = /^\s*INSERT\s+INTO\s/i.test(q);
  const finalQ   = isInsert ? `${q};\nSELECT SCOPE_IDENTITY() AS lastID` : q;
  const req = pool.request();
  params.forEach((v, i) => req.input(`p${i}`, v ?? null));
  const result = await req.query(finalQ);
  return { lastID: result.recordset?.[0]?.lastID ?? null };
}

/* SELECT → primera fila o null */
async function getAsync(query, params = []) {
  const req = pool.request();
  params.forEach((v, i) => req.input(`p${i}`, v ?? null));
  const result = await req.query(convertParams(query));
  return result.recordset[0] ?? null;
}

/* SELECT → array de filas */
async function allAsync(query, params = []) {
  const req = pool.request();
  params.forEach((v, i) => req.input(`p${i}`, v ?? null));
  const result = await req.query(convertParams(query));
  return result.recordset;
}

/* ──────────────────────────────────────────────
   Creación de tablas en T-SQL (SQL Server / Azure SQL)
────────────────────────────────────────────── */
async function createTables() {
  const tables = [
    `IF OBJECT_ID('clients','U') IS NULL
     CREATE TABLE clients (
       id         INT IDENTITY(1,1) PRIMARY KEY,
       name       NVARCHAR(255) NOT NULL,
       rfc        NVARCHAR(100),
       contact    NVARCHAR(255),
       phone      NVARCHAR(50),
       email      NVARCHAR(255),
       active     INT DEFAULT 1,
       created_at DATETIME DEFAULT GETDATE()
     )`,
    `IF OBJECT_ID('service_types','U') IS NULL
     CREATE TABLE service_types (
       id          INT IDENTITY(1,1) PRIMARY KEY,
       name        NVARCHAR(255) NOT NULL,
       description NVARCHAR(MAX),
       price       FLOAT NOT NULL DEFAULT 0,
       active      INT DEFAULT 1,
       created_at  DATETIME DEFAULT GETDATE()
     )`,
    `IF OBJECT_ID('client_services','U') IS NULL
     CREATE TABLE client_services (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       client_id       INT NOT NULL REFERENCES clients(id),
       service_type_id INT NOT NULL REFERENCES service_types(id),
       daily_limit     INT DEFAULT 0,
       weekly_limit    INT DEFAULT 0,
       active          INT DEFAULT 1,
       CONSTRAINT UQ_client_services UNIQUE (client_id, service_type_id)
     )`,
    `IF OBJECT_ID('employees','U') IS NULL
     CREATE TABLE employees (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       employee_number NVARCHAR(100) NOT NULL,
       name            NVARCHAR(255),
       email           NVARCHAR(255),
       department      NVARCHAR(255),
       position        NVARCHAR(255),
       biometric_id    NVARCHAR(100),
       client_id       INT REFERENCES clients(id),
       active          INT DEFAULT 1,
       created_at      DATETIME DEFAULT GETDATE(),
       CONSTRAINT UQ_employees UNIQUE (employee_number, client_id)
     )`,
    `IF OBJECT_ID('rfid_cards','U') IS NULL
     CREATE TABLE rfid_cards (
       id            INT IDENTITY(1,1) PRIMARY KEY,
       rfid_code     NVARCHAR(100) UNIQUE NOT NULL,
       employee_id   INT REFERENCES employees(id),
       assigned_at   DATETIME DEFAULT GETDATE(),
       unassigned_at DATETIME,
       active        INT DEFAULT 1
     )`,
    `IF OBJECT_ID('purchases','U') IS NULL
     CREATE TABLE purchases (
       id               INT IDENTITY(1,1) PRIMARY KEY,
       rfid_code        NVARCHAR(100) NOT NULL,
       employee_id      INT,
       employee_name    NVARCHAR(255),
       employee_number  NVARCHAR(100),
       client_id        INT,
       service_type_id  INT REFERENCES service_types(id),
       service_name     NVARCHAR(255),
       price            FLOAT NOT NULL DEFAULT 0,
       status           NVARCHAR(50) DEFAULT 'approved',
       rejection_reason NVARCHAR(MAX),
       created_at       DATETIME DEFAULT GETDATE()
     )`,
    `IF OBJECT_ID('schedules','U') IS NULL
     CREATE TABLE schedules (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       service_type_id INT NOT NULL REFERENCES service_types(id),
       day_of_week     INT NOT NULL,
       start_time      NVARCHAR(5) NOT NULL,
       end_time        NVARCHAR(5) NOT NULL,
       active          INT DEFAULT 1
     )`,
    `IF OBJECT_ID('employee_limits','U') IS NULL
     CREATE TABLE employee_limits (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       employee_id     INT NOT NULL REFERENCES employees(id),
       service_type_id INT REFERENCES service_types(id),
       daily_limit     INT DEFAULT 0,
       weekly_limit    INT DEFAULT 0,
       CONSTRAINT UQ_employee_limits UNIQUE (employee_id, service_type_id)
     )`,
    `IF OBJECT_ID('client_scan_methods','U') IS NULL
     CREATE TABLE client_scan_methods (
       id        INT IDENTITY(1,1) PRIMARY KEY,
       client_id INT NOT NULL REFERENCES clients(id),
       method    NVARCHAR(50) NOT NULL
                 CHECK(method IN ('rfid','employee_number','biometric')),
       enabled   INT DEFAULT 0,
       CONSTRAINT UQ_scan_methods UNIQUE (client_id, method)
     )`,
    `IF OBJECT_ID('users','U') IS NULL
     CREATE TABLE users (
       id         INT IDENTITY(1,1) PRIMARY KEY,
       username   NVARCHAR(100) UNIQUE NOT NULL,
       password   NVARCHAR(255) NOT NULL,
       role       NVARCHAR(50) NOT NULL
                  CHECK(role IN ('super_admin','admin_empresa','scanner')),
       client_id  INT REFERENCES clients(id),
       active     INT DEFAULT 1,
       created_at DATETIME DEFAULT GETDATE()
     )`,
    // Acceso individual por empleado por servicio (reemplaza employee_limits)
    `IF OBJECT_ID('employee_service_access','U') IS NULL
     CREATE TABLE employee_service_access (
       id              INT IDENTITY(1,1) PRIMARY KEY,
       employee_id     INT NOT NULL REFERENCES employees(id),
       service_type_id INT NOT NULL REFERENCES service_types(id),
       enabled         INT NOT NULL DEFAULT 1,
       daily_limit     INT NOT NULL DEFAULT 0,
       weekly_limit    INT NOT NULL DEFAULT 0,
       CONSTRAINT UQ_employee_service_access UNIQUE (employee_id, service_type_id)
     )`,
  ];

  for (const q of tables) {
    await pool.request().query(q);
  }

  // Migración: agregar silent_print a clients si no existe
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='clients' AND COLUMN_NAME='silent_print'
    )
    ALTER TABLE clients ADD silent_print INT NOT NULL DEFAULT 1
  `);

  // Migración: timezone configurable por empresa (offset en horas, ej. -6 = UTC-6)
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='clients' AND COLUMN_NAME='timezone_offset'
    )
    ALTER TABLE clients ADD timezone_offset INT NOT NULL DEFAULT -6
  `);

  // Migración: client_name denormalizado en purchases (protege historial si se renombra empresa)
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='purchases' AND COLUMN_NAME='client_name'
    )
    ALTER TABLE purchases ADD client_name NVARCHAR(255)
  `);

  // Seed empresas
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM clients WHERE name='Demo Company A')
      INSERT INTO clients (name) VALUES ('Demo Company A');
    IF NOT EXISTS (SELECT 1 FROM clients WHERE name='Demo Company B')
      INSERT INTO clients (name) VALUES ('Demo Company B');
    IF NOT EXISTS (SELECT 1 FROM clients WHERE name='Demo Company C')
      INSERT INTO clients (name) VALUES ('Demo Company C');
  `);

  // Seed métodos de cobro (employee_number habilitado por default)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM client_scan_methods
                   WHERE client_id=(SELECT id FROM clients WHERE name='Demo Company A')
                     AND method='employee_number')
      INSERT INTO client_scan_methods (client_id, method, enabled)
      VALUES ((SELECT id FROM clients WHERE name='Demo Company A'), 'employee_number', 1);

    IF NOT EXISTS (SELECT 1 FROM client_scan_methods
                   WHERE client_id=(SELECT id FROM clients WHERE name='Demo Company B')
                     AND method='employee_number')
      INSERT INTO client_scan_methods (client_id, method, enabled)
      VALUES ((SELECT id FROM clients WHERE name='Demo Company B'), 'employee_number', 1);

    IF NOT EXISTS (SELECT 1 FROM client_scan_methods
                   WHERE client_id=(SELECT id FROM clients WHERE name='Demo Company C')
                     AND method='employee_number')
      INSERT INTO client_scan_methods (client_id, method, enabled)
      VALUES ((SELECT id FROM clients WHERE name='Demo Company C'), 'employee_number', 1);
  `);

  // Seed usuarios (contraseña temporal — se migrará a bcrypt abajo)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM users WHERE username='admin')
      INSERT INTO users (username, password, role)
      VALUES ('admin', 'admin123', 'super_admin');
  `);


  // Seed admins de empresa
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM users WHERE username='Admin_CompanyA')
      INSERT INTO users (username, password, role, client_id)
      VALUES ('Admin_CompanyA', 'admin123', 'admin_empresa',
              (SELECT id FROM clients WHERE name='Demo Company A'));

    IF NOT EXISTS (SELECT 1 FROM users WHERE username='Admin_CompanyB')
      INSERT INTO users (username, password, role, client_id)
      VALUES ('Admin_CompanyB', 'admin123', 'admin_empresa',
              (SELECT id FROM clients WHERE name='Demo Company B'));

    IF NOT EXISTS (SELECT 1 FROM users WHERE username='Admin_CompanyC')
      INSERT INTO users (username, password, role, client_id)
      VALUES ('Admin_CompanyC', 'admin123', 'admin_empresa',
              (SELECT id FROM clients WHERE name='Demo Company C'));
  `);

  // Migración: hashear contraseñas que aún están en texto plano
  const plainUsers = await allAsync(
    `SELECT id, password FROM users WHERE password NOT LIKE '$2b$%'`, []
  );
  for (const u of plainUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    await runAsync('UPDATE users SET password=? WHERE id=?', [hashed, u.id]);
  }
  if (plainUsers.length > 0)
    console.log(`✅ ${plainUsers.length} contraseña(s) migradas a bcrypt`);
}

/* ──────────────────────────────────────────────
   Inicialización — llamar desde index.js antes de app.listen()
────────────────────────────────────────────── */
async function init() {
  const connStr = process.env.DB_CONNECTION_STRING;
  if (!connStr) throw new Error('La variable DB_CONNECTION_STRING no está definida');
  const config = parseConnectionString(connStr);
  pool = await sql.connect(config);
  console.log('✅ Conectado a Azure SQL Database');
  await createTables();
  console.log('✅ Tablas verificadas/creadas');
}

module.exports = { init, runAsync, getAsync, allAsync };
