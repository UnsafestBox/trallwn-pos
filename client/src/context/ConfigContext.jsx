import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/index.js'

const defaults = {
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

const ConfigContext = createContext(defaults)

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(defaults)

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {})
  }, [])

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

export function useConfig() {
  return useContext(ConfigContext)
}
