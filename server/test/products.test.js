const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, stopServer, clearDb, get, post, put, del } = require('./helpers')

before(startServer)
after(stopServer)
beforeEach(clearDb)

describe('product creation', () => {
  it('creates a product and returns it in the list', async () => {
    const res = await post('/api/products', {
      name: 'Guinness', category_id: 1, price_pence: 420, stock_qty: 50, min_stock: 5,
    })
    assert.equal(res.status, 201)

    const list = await get('/api/products')
    const p = list.body.find(p => p.name === 'Guinness')
    assert.ok(p)
    assert.equal(p.price_pence, 420)
    assert.equal(p.member_price_pence, null)
  })

  it('saves member price when provided', async () => {
    await post('/api/products', {
      name: 'Madri', category_id: 1, price_pence: 420, member_price_pence: 350,
    })
    const list = await get('/api/products')
    const p = list.body.find(p => p.name === 'Madri')
    assert.equal(p.member_price_pence, 350)
  })

  it('rejects creation without required fields', async () => {
    const res = await post('/api/products', { name: 'Incomplete' })
    assert.equal(res.status, 400)
  })
})

describe('product editing', () => {
  async function seed() {
    const res = await post('/api/products', { name: 'Peroni', category_id: 1, price_pence: 400 })
    return res.body.id
  }

  it('updates the price', async () => {
    const id = await seed()
    await put(`/api/products/${id}`, { price_pence: 450 })
    const list = await get('/api/products')
    assert.equal(list.body.find(p => p.id === id).price_pence, 450)
  })

  it('sets a member price on an existing product', async () => {
    const id = await seed()
    await put(`/api/products/${id}`, { member_price_pence: 320 })
    const list = await get('/api/products')
    assert.equal(list.body.find(p => p.id === id).member_price_pence, 320)
  })

  it('clears member price when set to null', async () => {
    const id = await seed()
    await put(`/api/products/${id}`, { member_price_pence: 320 })
    await put(`/api/products/${id}`, { member_price_pence: null })
    const list = await get('/api/products')
    assert.equal(list.body.find(p => p.id === id).member_price_pence, null)
  })

  it('updating stock does not affect member price', async () => {
    const id = await seed()
    await put(`/api/products/${id}`, { member_price_pence: 320 })
    await put(`/api/products/${id}`, { stock_qty: 99 })
    const list = await get('/api/products')
    const p = list.body.find(p => p.id === id)
    assert.equal(p.stock_qty, 99)
    assert.equal(p.member_price_pence, 320) // unchanged
  })

  it('soft-deletes a product (removes from list)', async () => {
    const id = await seed()
    await del(`/api/products/${id}`)
    const list = await get('/api/products')
    assert.ok(!list.body.find(p => p.id === id))
  })
})

describe('categories', () => {
  it('lists the default seeded categories', async () => {
    const res = await get('/api/categories')
    assert.ok(res.body.length >= 5)
    assert.ok(res.body.find(c => c.name === 'Draught'))
  })

  it('creates a new category', async () => {
    const res = await post('/api/categories', { name: 'Wines', sort_order: 6 })
    assert.equal(res.status, 201)
    const list = await get('/api/categories')
    assert.ok(list.body.find(c => c.name === 'Wines'))
  })
})
