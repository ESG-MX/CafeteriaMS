require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const path      = require('path');
const fs        = require('fs');
const http      = require('http');
const wsModule  = require('./ws');
const { init: initDB } = require('./db');

const app      = express();
const server   = http.createServer(app);
const distPath = path.join(__dirname, '../client/dist');

// ── Trust proxy (Azure App Service / load balancer) ───────────────
// Necesario para que express-rate-limit identifique IPs reales
// detrás del reverse proxy de Azure.
app.set('trust proxy', 1);

// ── Seguridad: headers HTTP ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // React maneja su propio CSP
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
}));

// ── Rate limiting: máx 10 intentos de login por IP cada 15 min ────
// ipKeyGenerator es el helper oficial de express-rate-limit que maneja
// correctamente IPv4, IPv6 y direcciones con puerto enviadas por Azure.
const loginLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   10,
  standardHeaders:       true,
  legacyHeaders:         false,
  message:               { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' },
  skipSuccessfulRequests: true,
  keyGenerator:          ipKeyGenerator,
});
app.use('/api/auth/login', loginLimiter);

app.use(express.json({ limit: '1mb' })); // límite en body JSON

// ── Rutas API ──────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/clients',    require('./routes/clients'));
app.use('/api/services',   require('./routes/services'));
app.use('/api/employees',  require('./routes/employees'));
app.use('/api/rfid',       require('./routes/rfid'));
app.use('/api/purchases',  require('./routes/purchases'));
app.use('/api/schedules',  require('./routes/schedules'));
app.use('/api/sign-print', require('./routes/sign'));

// ── Servir frontend React si el build existe ──────────────────────
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log('✅ Sirviendo frontend desde client/dist');
} else {
  console.log('⚠️  client/dist no encontrado — ejecuta: npm run build');
}

// ── Arrancar con DB inicializada ──────────────────────────────────
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDB();
    server.listen(PORT, () => {
      wsModule.init(server);
      console.log(`✅ Servidor CafeteriaMS corriendo en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar el servidor:', err.message);
    process.exit(1);
  }
}

start();
