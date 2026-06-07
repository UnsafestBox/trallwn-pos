const path = require('path')
const fs = require('fs')

const configPath = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config.json')

const defaults = {
  theme: 'dark',
  auth: {
    requirePin: true,
    inactivityTimeoutMinutes: 3,
    inactivityWarningSecs: 30,
  },
  features: {
    bills: true,
    reports: true,
    stockManagement: true,
    eventLog: true,
    memberPricing: true,
    offBook: true,
  },
}

function mergeDeep(base, overrides) {
  const result = { ...base }
  for (const key of Object.keys(base)) {
    if (overrides && overrides[key] !== undefined) {
      result[key] = (typeof base[key] === 'object' && base[key] !== null)
        ? mergeDeep(base[key], overrides[key])
        : overrides[key]
    }
  }
  return result
}

let userConfig = {}
try {
  userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
} catch {
  console.warn(`[config] ${configPath} not found or invalid — using defaults`)
}

module.exports = mergeDeep(defaults, userConfig)
