const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const api = {
  // Categories
  getCategories: () => req('GET', '/categories'),
  createCategory: (data) => req('POST', '/categories', data),
  deleteCategory: (id) => req('DELETE', `/categories/${id}`),

  // Products
  getProducts: () => req('GET', '/products'),
  createProduct: (data) => req('POST', '/products', data),
  updateProduct: (id, data) => req('PUT', `/products/${id}`, data),
  deleteProduct: (id) => req('DELETE', `/products/${id}`),

  // Tabs
  getTabs: (status = 'open') => req('GET', `/tabs?status=${status}`),
  getTab: (id) => req('GET', `/tabs/${id}`),
  createTab: (name) => req('POST', '/tabs', { name }),
  addItem: (tabId, product_id, quantity = 1, is_member = false) => req('POST', `/tabs/${tabId}/items`, { product_id, quantity, is_member }),
  removeItem: (tabId, itemId) => req('DELETE', `/tabs/${tabId}/items/${itemId}`),
  closeTab: (tabId, payment_method) => req('PUT', `/tabs/${tabId}/close`, { payment_method }),
  repriceTab: (tabId, is_member) => req('PUT', `/tabs/${tabId}/reprice`, { is_member }),
  deleteTab: (tabId) => req('DELETE', `/tabs/${tabId}`),

  // Reports
  getDailyReport: (date) => req('GET', `/reports/daily${date ? `?date=${date}` : ''}`),
  getStockAlerts: () => req('GET', '/reports/stock-alerts'),

  // Events log
  getEvents: ({ date, type, limit } = {}) => {
    const p = new URLSearchParams()
    if (date) p.set('date', date)
    if (type) p.set('type', type)
    if (limit) p.set('limit', limit)
    const qs = p.toString()
    return req('GET', `/events${qs ? `?${qs}` : ''}`)
  },
}
