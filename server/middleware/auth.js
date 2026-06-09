const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('❌ FATAL: JWT_SECRET no está definido en las variables de entorno');
  process.exit(1);
}

/* ──────────────────────────────────────────────
   Middleware: valida el JWT en cada petición
   Coloca req.user = { id, username, role, client_id }
────────────────────────────────────────────── */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'No autenticado — inicia sesión' });

  try {
    req.user = jwt.verify(header.split(' ')[1], SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada — vuelve a iniciar sesión' });
  }
}

/* ──────────────────────────────────────────────
   Middleware: solo super_admin puede acceder
────────────────────────────────────────────── */
function adminOnly(req, res, next) {
  if (req.user?.role !== 'super_admin')
    return res.status(403).json({ error: 'Acción restringida al administrador principal' });
  next();
}

/* ──────────────────────────────────────────────
   Helper: devuelve el client_id a aplicar en queries
   - super_admin → usa el que mande en query/body (o null = sin filtro)
   - admin_empresa / scanner → forzado al del token (imposible ver otra empresa)
────────────────────────────────────────────── */
function scopeClient(req) {
  if (req.user.role === 'super_admin') {
    return req.query.client_id
      || req.body?.client_id
      || null;
  }
  return req.user.client_id;
}

module.exports = { auth, adminOnly, scopeClient, SECRET };
