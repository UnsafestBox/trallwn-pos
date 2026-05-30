const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, stopServer, clearDb, get, post, put } = require('./helpers')

before(startServer)
after(stopServer)
beforeEach(clearDb)

async function seedProduct(price_pence = 420, member_price_pence = null) {
  const res = await post('/api/products', { name: 'Test Beer', category_id: 1, price_pence, member_price_pence, stock_qty: 100 })
  return res.body.id
}

async function sellTab({ items = [], payment_method = 'card', is_member = false } = {}) {
  const tab = await post('/api/tabs', { name: 'Test Tab' })
  const tid = tab.body.id
  for (const { product_id, quantity = 1 } of items) {
    for (let i = 0; i < quantity; i++) {
      await post(`/api/tabs/${tid}/items`, { product_id, is_member })
    }
  }
  await put(`/api/tabs/${tid}/close`, { payment_method })
  return tid
}

describe('daily report', () => {
  it('shows zero totals when no tabs closed today', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await get(`/api/reports/daily?date=${today}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.summary.total_pence, 0)
    assert.equal(res.body.summary.tab_count, 0)
  })

  it('sums closed tab totals correctly', async () => {
    const pid = await seedProduct(420)
    await sellTab({ items: [{ product_id: pid, quantity: 3 }], payment_method: 'card' })

    const today = new Date().toISOString().slice(0, 10)
    const res = await get(`/api/reports/daily?date=${today}`)
    assert.equal(res.body.summary.total_pence, 1260) // 3 × £4.20
    assert.equal(res.body.summary.tab_count, 1)
  })

  it('splits cash and card totals correctly', async () => {
    const pid = await seedProduct(500)
    await sellTab({ items: [{ product_id: pid }], payment_method: 'cash' })
    await sellTab({ items: [{ product_id: pid }], payment_method: 'card' })

    const today = new Date().toISOString().slice(0, 10)
    const res = await get(`/api/reports/daily?date=${today}`)
    assert.equal(res.body.summary.cash_pence, 500)
    assert.equal(res.body.summary.card_pence, 500)
    assert.equal(res.body.summary.total_pence, 1000)
  })

  it('uses the member price in totals when applicable', async () => {
    const pid = await seedProduct(420, 300)
    await sellTab({ items: [{ product_id: pid }], payment_method: 'card', is_member: true })

    const today = new Date().toISOString().slice(0, 10)
    const res = await get(`/api/reports/daily?date=${today}`)
    assert.equal(res.body.summary.total_pence, 300) // member price, not £4.20
  })

  it('lists top sellers ranked by quantity', async () => {
    const pid1 = await seedProduct(420)
    const pid2 = await post('/api/products', { name: 'Madri', category_id: 1, price_pence: 400, stock_qty: 100 }).then(r => r.body.id)

    await sellTab({ items: [{ product_id: pid1, quantity: 3 }, { product_id: pid2, quantity: 1 }] })

    const today = new Date().toISOString().slice(0, 10)
    const res = await get(`/api/reports/daily?date=${today}`)
    assert.equal(res.body.topItems[0].qty, 3)  // Test Beer sold most
    assert.equal(res.body.topItems[1].qty, 1)
  })

  it('excludes open (unsettled) tabs from totals', async () => {
    const pid = await seedProduct(420)
    const tab = await post('/api/tabs', { name: 'Open Tab' })
    await post(`/api/tabs/${tab.body.id}/items`, { product_id: pid })
    // deliberately NOT closing the tab

    const today = new Date().toISOString().slice(0, 10)
    const res = await get(`/api/reports/daily?date=${today}`)
    assert.equal(res.body.summary.total_pence, 0)
  })
})

describe('stock alerts', () => {
  it('flags products at or below min stock', async () => {
    await post('/api/products', { name: 'Low Beer', category_id: 1, price_pence: 400, stock_qty: 3, min_stock: 5 })
    const res = await get('/api/reports/stock-alerts')
    assert.ok(res.body.find(p => p.name === 'Low Beer'))
  })

  it('does not flag products above min stock', async () => {
    await post('/api/products', { name: 'Full Beer', category_id: 1, price_pence: 400, stock_qty: 50, min_stock: 5 })
    const res = await get('/api/reports/stock-alerts')
    assert.ok(!res.body.find(p => p.name === 'Full Beer'))
  })
})
