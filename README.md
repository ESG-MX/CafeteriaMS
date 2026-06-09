# CafeteriaMS

Sistema de gestión de comedor empresarial multi-tenant. Los empleados acceden a los servicios de comida mediante tarjeta RFID o número de empleado; las transacciones se registran en tiempo real, se aplican límites por empleado y se generan reportes detallados en Excel para nómina.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Backend | Node.js 22, Express, WebSocket (ws) |
| Autenticación | JWT + bcrypt, control de acceso por roles |
| Base de datos | SQLite (demo local) / Azure SQL (producción) |
| Impresión | QZ Tray (tickets térmicos) |
| Reportes | ExcelJS (exportación a Excel con formato) |
| Despliegue | Azure App Service + GitHub Actions |

## Funcionalidades

- **Escaneo RFID / Número de empleado / Biométrico** en punto de servicio
- **Multi-tenant**: empresas ilimitadas, cada una con sus propios empleados, servicios y límites
- **Detección de servicio por horario**: asigna automáticamente Desayuno / Comida / Cena según la hora
- **Límites por empleado**: cuotas diarias y semanales configurables por servicio
- **Dashboard en vivo**: KPIs en tiempo real y feed de transacciones vía WebSocket
- **Reportes Excel**: exportación detallada de transacciones y documento mensual de nómina con desglose de IVA
- **Roles**: `super_admin` (todas las empresas), `admin_empresa` (una empresa), `scanner` (solo terminal)
- **Impresión térmica**: impresión silenciosa vía QZ Tray con firma RSA

## Inicio rápido (Demo local — SQLite, sin Azure)

### Requisitos

- Node.js 22+
- npm 9+

### Pasos

```bash
# 1. Clona el repositorio
git clone https://github.com/ESG-MX/CafeteriaMS.git
cd CafeteriaMS

# 2. Instala dependencias del backend
npm install

# 3. Crea tu archivo .env
cp .env.example .env
# El único valor requerido para la demo local es JWT_SECRET

# 4. Instala dependencias del frontend
npm --prefix client install

# 5. Inicia los servidores (backend en :3001, frontend en :5173)
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

### Credenciales de demo

| Usuario | Contraseña | Rol | Acceso |
|---------|-----------|-----|--------|
| `admin` | `admin123` | Super Admin | Todas las empresas |
| `Admin_CompanyA` | `admin123` | Admin | Demo Company A |
| `Admin_CompanyB` | `admin123` | Admin | Demo Company B |
| `Admin_CompanyC` | `admin123` | Admin | Demo Company C |

> **Flujo de login**: selecciona una empresa en la primera pantalla y luego ingresa tus credenciales.
> El Super Admin puede seleccionar cualquier empresa.

## Producción (Azure SQL)

1. Define `DB_CONNECTION_STRING` en tu `.env` (o en las variables de entorno de App Service) con tu cadena de conexión ADO.NET de Azure SQL.
2. Elimina `USE_SQLITE=true` si está definido — la app detecta Azure SQL automáticamente.
3. Despliega con `npm run build && npm start`, o haz push a la rama `master` (el workflow de CI corre pero el paso de deploy está deshabilitado por defecto — actívalo en `.github/workflows/` si es necesario).

## Estructura del proyecto

```
├── server/
│   ├── index.js          # Express + servidor HTTP + WebSocket
│   ├── db.js             # Adaptador Azure SQL (mssql)
│   ├── db-sqlite.js      # Adaptador SQLite (demo local)
│   ├── middleware/
│   │   └── auth.js       # Verificación JWT + guards por rol
│   └── routes/           # Módulos de rutas de la API
├── client/
│   ├── src/
│   │   ├── pages/        # Páginas React
│   │   ├── layout/       # Sidebar + Topbar
│   │   ├── context/      # Contexto de autenticación y permisos
│   │   └── utils/        # Helper de impresión (QZ Tray)
│   └── public/           # Archivos estáticos
└── .github/workflows/    # CI (deploy deshabilitado)
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con empresa + credenciales |
| GET | `/api/dashboard` | KPIs + actividad reciente |
| POST | `/api/rfid/scan` | Procesar un escaneo de comida (transacción principal) |
| GET/POST/PUT | `/api/employees` | CRUD de empleados + carga masiva |
| GET/POST/PUT | `/api/clients` | Gestión de empresas |
| GET/POST/PUT | `/api/services` | Catálogo de servicios |
| GET | `/api/purchases` | Historial de transacciones |
| GET | `/api/reports` | Exportación a Excel |
| GET/POST/PUT | `/api/users` | Gestión de usuarios |
