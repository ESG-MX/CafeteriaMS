const { WebSocketServer, OPEN } = require('ws')

let wss = null

function init(server) {
  wss = new WebSocketServer({ server })
  wss.on('connection', (ws) => {
    ws.on('error', () => {})
  })
}

function broadcast(data) {
  if (!wss) return
  const msg = JSON.stringify(data)
  wss.clients.forEach(client => {
    if (client.readyState === OPEN) client.send(msg)
  })
}

module.exports = { init, broadcast }
