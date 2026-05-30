const crypto = require('node:crypto')

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex')
}

function randomToken() {
  return crypto.randomUUID()
}

module.exports = { hashPin, randomToken }
