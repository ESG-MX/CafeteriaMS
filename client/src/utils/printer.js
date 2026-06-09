/**
 * printer.js — Módulo de impresión para SDC
 *
 * Estrategia:
 *   1. Intenta conectar a QZ Tray (wss://localhost:8181 primero, ws://localhost:8182 como fallback)
 *   2. Si está disponible → imprime directo sin diálogo
 *   3. Si no está instalado o falla → fallback a window.print()
 */

import qz from 'qz-tray'

// Certificado QZ Tray (válido hasta 2036) — registrar en Allowed list de QZ Tray
const CERT = `-----BEGIN CERTIFICATE-----
MIIDpzCCAo+gAwIBAgIUaMbHjnTyCibcyAUAikqW6hUDniIwDQYJKoZIhvcNAQEL
BQAwgZoxCzAJBgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0
b3RhMRswGQYDVQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIElu
ZHVzdHJpZXMsIExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzESMBAG
A1UEAwwJbG9jYWxob3N0MB4XDTI2MDYwNDE5MjQ0NloXDTM2MDYwMTE5MjQ0Nlow
PDEXMBUGA1UEAwwOU0RDLUdydXBvQmVyc2ExFDASBgNVBAoMC0dydXBvIEJlcnNh
MQswCQYDVQQGEwJNWDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAMVE
A8v2S0vVELSPsnq8u7tzTq2CWoLY0yXHdut7OSY8nx+MIBqr2qFjaL2B4oOxQPu6
Ps+DrUv4B2g5bSmnOLtO4Zn1M1Nqqmfdlrp1RGnErb4EUtBBPGetlRBGwRH+xx/J
WEQpkt+u3/jNgT3MaBfVuFQkgB00HE1x4kxPd9s5Aeb6a5N7fWeYYOjI6seydN7L
B5yyklpnDAnFhAtXzr8/akXJnFCFFdIFusnhVLT3uxmYEg1rdHJk9/6w21HNCCkB
5o154DWyVNqc03DN2BFFnNXR32IInQ4Px6ApWbUoUS0zsGxCFzDA/Ri3f5loyhti
K9gUsxLncWb7+5NRA4UCAwEAAaNCMEAwHQYDVR0OBBYEFHKebRkFxtVdeBCQLoKF
+2jZdGX3MB8GA1UdIwQYMBaAFPZ5p/t0ET16h/b8o7T3J8mNbymqMA0GCSqGSIb3
DQEBCwUAA4IBAQBJf+nJ048dg6/OGFjDHIP62VK3GJPz2qJjf/YZ1j0aoUZ2dZDK
qA8mweRLqbUlqXbavdxrw14gLIh07hCauC6Ldg2vwPWm09ieU2LCmrkt2ZwPGeCZ
zPveQKv2Gvh2vIH+jvC2FkmnySM2yFumu0sPHxkRk2u+/1xBY4OtKQufsV7Rklc0
UEN8xOV7z0eg9Zxdpv1OdLEPh4A7Hgz7YUdUwadfRRVxcguX0UQNFRyY3QiY3gvU
EryLQufySln5Ph7zH6KEBM+pHlJSPyyr8Ogvx4UnHB1/a/atOs9hwQG1Wbv/+Jo5
MlqauDXwit5lbdeWWLkh1A5gXSF71dmMuND/
-----END CERTIFICATE-----`

// Clave privada PKCS#8 — par del certificado anterior.
// Firmamos en el browser con Web Crypto para evitar round-trip al servidor
// y cualquier problema de encoding JSON que invalide la firma.
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDFRAPL9ktL1RC0
j7J6vLu7c06tglqC2NMlx3brezkmPJ8fjCAaq9qhY2i9geKDsUD7uj7Pg61L+Ado
OW0ppzi7TuGZ9TNTaqpn3Za6dURpxK2+BFLQQTxnrZUQRsER/scfyVhEKZLfrt/4
zYE9zGgX1bhUJIAdNBxNceJMT3fbOQHm+muTe31nmGDoyOrHsnTeywecspJaZwwJ
xYQLV86/P2pFyZxQhRXSBbrJ4VS097sZmBINa3RyZPf+sNtRzQgpAeaNeeA1slTa
nNNwzdgRRZzV0d9iCJ0OD8egKVm1KFEtM7BsQhcwwP0Yt3+ZaMobYivYFLMS53Fm
+/uTUQOFAgMBAAECggEAKDdqkr1+slIY2sbk+zLZDyk95A/MRhrQSUZ2DyILD6mS
Q0s9DFL2+qoao3AEbxbHCcr5nTLaNL+3Ot9iSvilj0JQqiOcOChp300EurTHosyP
I0scWwrBtt1jo3LZT8Lic6+HyDW1lNbBIKc87w1qN1nB/52FZO7Hyl4qZaZZ6B5G
WP81aWot8cdDmGPAE7YWmk6UOGp6AQtnPZiVCbdh1+B2HoC1+YOsLfycrm9a0qCk
kN/uAKp39sk5vrL0ITkt4wPo+pzOhWr0iPi16bslGP+9U0aDW96uDwITefZfHvPv
cHK7Cnc2GOu6+/HjE0pJYId2liRQBMYvFl30SYqJQQKBgQDwLKG6Q66dE6QYvuDT
WrFv2BdQMu2QX+UytGoWrWXOY2VrerPGJuq3WXGWD2DILRwZ6pgqBmfL5zBLMzZz
V45IZgualTOCYjZ3YFbH3v0TXQF8h/qfE55fUBAFFCM+tGQY8Lexj4HJjb8AWlaC
GO+1w6z7e+1LDZemAaMZcCIvtQKBgQDSQ5SjHwax7DKQjsdWdEM2VkpJZShiRJeS
OtLXQonCSzbxE0PjfmTSb3F4RCr0iGeXa84D8512+Koi4X/BUX60L1/oetY8+yy7
97/UdM5H5D8ZmQJyBRGgXa2NoCoHgsSEyxJWK/lVIDkmxK9f2RUH8w/kKtF4NaFE
Op5635bGkQKBgBVm5MKEZXr51RWfbMlou4cL6ofrAeBrqzDpgsqiiP/rO45oULzH
mwLbpZOJq0YrPuXQUd7s0zMIVvVciu2cT8GD1mTgBscHmXLp0tHcvRCMqSU/uMWU
Kfi0WbkaIknkKUdPrA7Wiuo7B1owsqTFNBcuaKvAT1Tw0SKp4q7RnzpBAoGBAKJ6
rJpcuFy3C9/fJTSuhN2xUphivhEptgK+x/ylozRr0Nn7rCNYoWpnycRI0PTDj2FY
Ygt1roGn6DkqDgICCqoMTc2lVnYrFkduTGNNm7W8L/KE5XncZuGIYjulv7SsHVYM
YnAKbRKV4vQNWwPzCShqcCY93D5LGwJRVfPXYXixAoGAFYildSxY9Me86VNxS6uf
2uBhEDfT4swzUgEGJvFsnsk0VmdI5knxmt/vVK5MU/ungL7bdb5i4Ddqf6ZVeoH0
xPuDY4HzqxZ3k6Ye+WwgydglOc+q2NDq+3K7A6RcAE6506PJC5x3pgYnKCanT2Tv
jBVYnkVzzjPKtXtQUjPWTyA=
-----END PRIVATE KEY-----`

// CryptoKey cacheado — se importa una sola vez
let _cryptoKey = null
async function _getSigningKey() {
  if (_cryptoKey) return _cryptoKey
  const pem = PRIVATE_KEY_PEM.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0))
  _cryptoKey = await crypto.subtle.importKey(
    'pkcs8', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    false, ['sign']
  )
  return _cryptoKey
}

// QZ Tray verifica cert contra Allowed list, luego valida la firma del job
qz.security.setCertificatePromise((resolve) => resolve(CERT))
qz.security.setSignatureAlgorithm('SHA512') // requerido desde QZ Tray 2.1
qz.security.setSignaturePromise((toSign) => async (resolve, reject) => {
  try {
    const key  = await _getSigningKey()
    const data = new TextEncoder().encode(toSign)
    const sig  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data)
    resolve(btoa(String.fromCharCode(...new Uint8Array(sig))))
  } catch (err) {
    warn('error firmando:', err)
    reject(err)
  }
})

const log = (...args) => console.log('[QZ-Tray]', new Date().toISOString(), ...args)
const warn = (...args) => console.warn('[QZ-Tray]', new Date().toISOString(), ...args)

// Notificar al Scanner el estado de conexión
const _listeners = new Set()
export function onQZStatusChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn) }
function _emit(status, detail = '') {
  log(`status → ${status}`, detail)
  _listeners.forEach(fn => fn(status, detail))
}

let _connected = false

export async function connect() {
  if (_connected && qz.websocket.isActive()) {
    log('ya conectado, reutilizando WebSocket')
    return true
  }
  _connected = false

  log('intentando conectar a QZ Tray...')
  try {
    await qz.websocket.connect({ retries: 2, delay: 1 })
    _connected = true
    _emit('connected', 'wss://localhost:8181')
    return true
  } catch (err) {
    const msg = err?.message ?? String(err)
    // "already exists" = la conexión está abierta (el diálogo aún pendiente o ya resuelto)
    if (msg.includes('already exists') || msg.includes('already open')) {
      log('conexión ya existe — reutilizando')
      _connected = true
      _emit('connected', 'wss://localhost:8181 (existente)')
      return true
    }
    warn('QZ Tray no disponible:', msg)
    _emit('unavailable', msg)
    return false
  }
}

export async function disconnect() {
  if (_connected) {
    try { await qz.websocket.disconnect() } catch { /* ignore */ }
    _connected = false
    _emit('disconnected')
  }
}

/** Verifica si QZ Tray está activo sin intentar reconectar */
export function isQZConnected() { return _connected && qz.websocket.isActive() }

/**
 * Genera el HTML del ticket como string puro.
 * Se usa tanto para QZ Tray como referencia visual.
 * logoUrl: URL absoluta del logo (ej: window.location.origin + '/logo-horizontal.png')
 */
export function buildTicketHTML({ clientName, employeeName, employeeNumber, serviceName, price, timestamp, purchaseId, logoUrl }) {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const d = new Date(timestamp)
  const fecha = `${String(d.getDate()).padStart(2,'0')}/${months[d.getMonth()]}/${d.getFullYear()}  ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9pt;
    font-weight: bold;
    color: #000;
    width: 72mm;
    padding: 2mm 2mm 0 2mm;
    -webkit-font-smoothing: none;
    /* display:table fuerza a QZ Tray a medir la altura exacta del contenido
       evitando que tome la altura de página predeterminada (carta/A4)     */
    display: table;
  }
  .center { text-align: center; }
  .row    { display: flex; justify-content: space-between; margin: 1px 0; }
  /* Separador con borde CSS — nunca se parte por ancho */
  .sep    { border-top: 1px dashed #000; margin: 3px 0; }
  .sep-solid { border-top: 2px solid #000; margin: 3px 0; }
  .price  { font-size: 12pt; }
  .big    { font-size: 10pt; letter-spacing: 1px; }
  .logo   { width: 14mm; height: 14mm; object-fit: contain; display: table; margin: 0 auto 1px; }
</style>
</head>
<body>
  <div class="center">
    ${logoUrl ? `<img src="${logoUrl}" style="width:40mm;display:table;margin:0 auto 2px;" alt="CafeteriaMS">` : '<div class="big">CafeteriaMS</div>'}
    <div style="font-size:7pt;letter-spacing:2px;">CAFETERIA MANAGEMENT SYSTEM</div>
  </div>

  <div class="sep-solid"></div>

  <div style="margin: 3px 0">
    <div class="row"><span>Empresa:</span><span>${clientName}</span></div>
    <div class="row"><span>Empleado:</span><span>${employeeName || '—'}</span></div>
    <div class="row"><span>No. Emp:</span><span>${employeeNumber}</span></div>
  </div>

  <div class="sep"></div>

  <div class="row"><span>Servicio:</span><span>${serviceName}</span></div>
  <div class="row price"><span>Precio:</span><span>$${Number(price).toFixed(2)}</span></div>

  <div class="sep"></div>

  <div style="margin: 2px 0">
    <div class="row"><span>Fecha:</span><span>${fecha}</span></div>
    <div class="row"><span>Folio:</span><span>#${purchaseId}</span></div>
  </div>

  <div class="sep-solid"></div>

  <div class="center" style="margin: 2px 0 6mm;">
    <div class="big">¡Buen provecho!</div>
  </div>
</body>
</html>`
}

/**
 * Abre una ventana emergente con solo el HTML del ticket y lanza print().
 * Evita imprimir la página completa (donde #sdc-ticket está oculto).
 */
function _printViaPopup(html) {
  const w = window.open('', '_blank', 'width=320,height=520,menubar=no,toolbar=no,location=no,status=no')
  if (!w) {
    warn('popup bloqueado — el navegador impide ventanas emergentes')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.addEventListener('load', () => {
    w.focus()
    w.print()
    // Cerrar la ventana después de que se cierre el diálogo de impresión
    w.addEventListener('afterprint', () => w.close())
  })
}

/**
 * printTicket(data, options)
 *
 * @param {object} data           – mismos campos que buildTicketHTML
 * @param {object} [options]
 * @param {boolean} [options.silent=true]  – true = QZ Tray sin diálogo
 *                                           false = popup con diálogo del navegador
 * @param {string}  [options.printerName]  – nombre de impresora en Windows
 *                                           null = predeterminada
 */
export async function printTicket(data, { silent = true, printerName = null } = {}) {
  log(`printTicket llamado — silent=${silent}`)

  const html = buildTicketHTML(data)

  // Si silent_print está desactivado → popup con diálogo del navegador
  if (!silent) {
    log('silent=false → popup print')
    _emit('fallback', 'popup')
    _printViaPopup(html)
    return { method: 'browser' }
  }

  // ── Intentar QZ Tray ─────────────────────────────────────────
  const ok = await connect()
  if (ok) {
    try {
      const printer = printerName ?? await qz.printers.getDefault()
      log(`impresora seleccionada: "${printer}"`)

      const config = qz.configs.create(printer, {
        size:         { width: 80, height: 0 },
        units:        'mm',
        margins:      { top: 0, right: 0, bottom: 0, left: 0 },
        scaleContent: false,
        copies:       1,
      })
      log('enviando job a QZ Tray...')
      await qz.print(config, [{
        type:   'pixel',
        format: 'html',
        flavor: 'plain',
        data:   html,
      }])
      log('job enviado OK')
      _emit('printed', printer)
      return { method: 'qz', printer }
    } catch (err) {
      warn('error al imprimir con QZ Tray:', err?.message ?? err, err)
      _emit('print-error', err?.message ?? String(err))
      await disconnect()
    }
  }

  // ── Fallback: popup con diálogo del navegador ────────────────
  log('fallback → popup print')
  _emit('fallback', 'popup')
  _printViaPopup(html)
  return { method: 'browser' }
}
