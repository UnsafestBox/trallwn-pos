const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, stopServer, clearDb, get, post, put, del, db } = require('./helpers')

before(startServer)
after(stopServer)
beforeEach(clearDb)

// Seed a product and return its id
async function seedProduct({ name = 'Guinness', price_pence = 420, member_price_pence = null, stock_qty = 50 } = {}) {
  const res = await post('/api/products', { name, category_id: 1, price_pence, member_price_pence, stock_qty, min_stock: 5 })
  return res.body.id
}

async function openTab(name = 'Table 1') {
  const res = await post('/api/tabs', { name })
  return res.body.id
}

describe('tab lifecycle', () => {
  it('opens a tab and returns id', async () => {
    const res = await post('/api/tabs', { name: 'Table 1' })
    assert.equal(res.status, 201)
    assert.ok(res.body.id)
  })

  it('appears in open tabs list', async () => {
    await openTab('John')
    const res = await get('/api/tabs?status=open')
    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].name, 'John')
  })

  it('settles a tab and moves it to closed', async () => {
    const pid = await seedProduct()
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid })
    await put(`/api/tabs/${tid}/close`, { payment_method: 'cash' })

    const open   = await get('/api/tabs?status=open')
    const closed = await get('/api/tabs?status=closed')
    assert.equal(open.body.length, 0)
    assert.equal(closed.body.length, 1)
    assert.equal(closed.body[0].payment_method, 'cash')
  })

  it('voids a tab and removes it entirely', async () => {
    const pid = await seedProduct()
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid })
    await del(`/api/tabs/${tid}`)

    const open = await get('/api/tabs?status=open')
    assert.equal(open.body.length, 0)
  })

  it('returns 404 when adding to a closed tab', async () => {
    const pid = await seedProduct()
    const tid = await openTab()
    await put(`/api/tabs/${tid}/close`, { payment_method: 'card' })
    const res = await post(`/api/tabs/${tid}/items`, { product_id: pid })
    assert.equal(res.status, 404)
  })
})

describe('pricing — member vs non-member', () => {
  it('uses standard price by default', async () => {
    const pid = await seedProduct({ price_pence: 420, member_price_pence: 300 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: false })

    const tab = await get(`/api/tabs/${tid}`)
    assert.equal(tab.body.items[0].unit_price_pence, 420)
    assert.equal(tab.body.items[0].is_member, 0)
  })

  it('uses member price when is_member is true', async () => {
    const pid = await seedProduct({ price_pence: 420, member_price_pence: 300 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: true })

    const tab = await get(`/api/tabs/${tid}`)
    assert.equal(tab.body.items[0].unit_price_pence, 300)
    assert.equal(tab.body.items[0].is_member, 1)
  })

  it('falls back to standard price when product has no member price', async () => {
    const pid = await seedProduct({ price_pence: 420, member_price_pence: null })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: true })

    const tab = await get(`/api/tabs/${tid}`)
    assert.equal(tab.body.items[0].unit_price_pence, 420)
    assert.equal(tab.body.items[0].is_member, 0)
  })

  it('tab total reflects correct price tier', async () => {
    const pid = await seedProduct({ price_pence: 420, member_price_pence: 300 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: true })
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: true })

    const tab = await get(`/api/tabs/${tid}`)
    assert.equal(tab.body.total_pence, 600) // 2 × £3.00
  })
})

describe('repricing a tab', () => {
  it('switches all items from standard to member price', async () => {
    const pid = await seedProduct({ price_pence: 420, member_price_pence: 300 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: false })
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: false })

    await put(`/api/tabs/${tid}/reprice`, { is_member: true })

    const tab = await get(`/api/tabs/${tid}`)
    for (const item of tab.body.items) {
      assert.equal(item.unit_price_pence, 300)
      assert.equal(item.is_member, 1)
    }
  })

  it('switches all items from member back to standard price', async () => {
    const pid = await seedProduct({ price_pence: 420, member_price_pence: 300 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid, is_member: true })

    await put(`/api/tabs/${tid}/reprice`, { is_member: false })

    const tab = await get(`/api/tabs/${tid}`)
    assert.equal(tab.body.items[0].unit_price_pence, 420)
    assert.equal(tab.body.items[0].is_member, 0)
  })

  it('leaves items at standard price when product has no member price', async () => {
    const pid = await seedProduct({ price_pence: 420, member_price_pence: null })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid })

    await put(`/api/tabs/${tid}/reprice`, { is_member: true })

    const tab = await get(`/api/tabs/${tid}`)
    assert.equal(tab.body.items[0].unit_price_pence, 420)
  })
})

describe('stock management', () => {
  it('decrements stock when item is added to a tab', async () => {
    const pid = await seedProduct({ stock_qty: 50 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid })

    const products = await get('/api/products')
    const p = products.body.find(p => p.id === pid)
    assert.equal(p.stock_qty, 49)
  })

  it('restores stock when item is removed from a tab', async () => {
    const pid = await seedProduct({ stock_qty: 50 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid })
    const tab = await get(`/api/tabs/${tid}`)
    await del(`/api/tabs/${tid}/items/${tab.body.items[0].id}`)

    const products = await get('/api/products')
    const p = products.body.find(p => p.id === pid)
    assert.equal(p.stock_qty, 50)
  })

  it('restores all stock when a tab is voided', async () => {
    const pid = await seedProduct({ stock_qty: 50 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid })
    await post(`/api/tabs/${tid}/items`, { product_id: pid })
    await del(`/api/tabs/${tid}`)

    const products = await get('/api/products')
    const p = products.body.find(p => p.id === pid)
    assert.equal(p.stock_qty, 50)
  })

  it('does not restore stock when a tab is settled normally', async () => {
    const pid = await seedProduct({ stock_qty: 50 })
    const tid = await openTab()
    await post(`/api/tabs/${tid}/items`, { product_id: pid })
    await put(`/api/tabs/${tid}/close`, { payment_method: 'card' })

    const products = await get('/api/products')
    const p = products.body.find(p => p.id === pid)
    assert.equal(p.stock_qty, 49)
  })
})
