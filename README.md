# CafeteriaMS

A full-stack multi-tenant meal management system for enterprise cafeterias. Employees access meal services using RFID cards or employee numbers; transactions are recorded in real time, limits enforced per employee, and detailed Excel reports generated for payroll.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| Backend | Node.js 22, Express, WebSocket (ws) |
| Auth | JWT + bcrypt, role-based access control |
| Database | SQLite (local demo) / Azure SQL (production) |
| Printing | QZ Tray (thermal receipts) |
| Reports | ExcelJS (Excel export with formatting) |
| Deploy | Azure App Service + GitHub Actions |

## Features

- **RFID / Employee number / Biometric** scanning at point of service
- **Multi-tenant**: unlimited companies, each with its own employees, services, and limits
- **Time-based service detection**: automatically assigns Breakfast / Lunch / Dinner based on time of day
- **Per-employee limits**: daily and weekly caps configurable per service
- **Live dashboard**: real-time KPIs and transaction feed via WebSocket
- **Excel reports**: detailed transaction export + formal monthly payroll document with IVA breakdown
- **Roles**: `super_admin` (all companies), `admin_empresa` (one company), `scanner` (terminal only)
- **Thermal printing**: silent printing via QZ Tray with RSA signature

## Quick Start (Local Demo — SQLite, no Azure required)

### Prerequisites

- Node.js 22+
- npm 9+

### Steps

```bash
# 1. Clone the repo
git clone <repo-url>
cd CafeteriaMS

# 2. Install dependencies (includes better-sqlite3 for local DB)
npm install

# 3. Create your .env file
cp .env.example .env
# Edit .env — the only required value for local demo is JWT_SECRET

# 4. Install frontend dependencies
npm --prefix client install

# 5. Start dev server (backend on :3001, frontend on :5173)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Demo credentials

| Username | Password | Role | Access |
|----------|----------|------|--------|
| `admin` | `admin123` | Super Admin | All companies |
| `Admin_CompanyA` | `admin123` | Admin | Demo Company A |
| `Admin_CompanyB` | `admin123` | Admin | Demo Company B |
| `Admin_CompanyC` | `admin123` | Admin | Demo Company C |

> **First login flow**: select a company on the first screen, then enter your credentials.
> The Super Admin can select any company.

## Production (Azure SQL)

1. Set `DB_CONNECTION_STRING` in your `.env` (or App Service environment variables) to your Azure SQL ADO.NET connection string.
2. Remove `USE_SQLITE=true` if set — the app detects Azure SQL automatically.
3. Deploy with `npm run build && npm start`, or push to the `master` branch (CI workflow runs but deploy step is disabled by default — re-enable it in `.github/workflows/` if needed).

## Project Structure

```
├── server/
│   ├── index.js          # Express + HTTP server + WebSocket
│   ├── db.js             # Azure SQL adapter (mssql)
│   ├── db-sqlite.js      # SQLite adapter (local demo)
│   ├── middleware/
│   │   └── auth.js       # JWT verification + role guards
│   └── routes/           # API route modules
├── client/
│   ├── src/
│   │   ├── pages/        # React pages
│   │   ├── layout/       # Sidebar + Topbar
│   │   ├── context/      # Auth context + permissions
│   │   └── utils/        # Printer helper (QZ Tray)
│   └── public/           # Static assets
└── .github/workflows/    # CI (deploy disabled)
```

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with company + credentials |
| GET | `/api/dashboard` | KPIs + recent activity |
| POST | `/api/rfid/scan` | Process a meal scan (core transaction) |
| GET/POST/PUT | `/api/employees` | Employee CRUD + bulk upload |
| GET/POST/PUT | `/api/clients` | Company management |
| GET/POST/PUT | `/api/services` | Service catalog |
| GET | `/api/purchases` | Transaction history |
| GET | `/api/reports` | Excel export |
| GET/POST/PUT | `/api/users` | User management |
