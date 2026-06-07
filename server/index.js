const app = require('./app')
const config = require('./config')

function shutdown() {
  const db = require('./db')
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

const PORT = process.env.PORT || config.port
app.listen(PORT, () => console.log(`POS server running on http://localhost:${PORT}`))
