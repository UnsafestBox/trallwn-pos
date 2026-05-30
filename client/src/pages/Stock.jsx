import React, { useState, useEffect } from 'react'
import { api } from '../api/index.js'

function fmt(pence) { return `£${(pence / 100).toFixed(2)}` }

const EMPTY_FORM = { name: '', category_id: '', price: '', member_price: '', stock: '', min_stock: '' }

function productToForm(p) {
  return {
    name: p.name,
    category_id: String(p.category_id),
    price: (p.price_pence / 100).toFixed(2),
    member_price: p.member_price_pence != null ? (p.member_price_pence / 100).toFixed(2) : '',
    stock: String(p.stock_qty),
    min_stock: String(p.min_stock),
  }
}

function formToPayload(form) {
  return {
    name: form.name,
    category_id: Number(form.category_id),
    price_pence: Math.round(parseFloat(form.price) * 100),
    member_price_pence: form.member_price !== '' ? Math.round(parseFloat(form.member_price) * 100) : null,
    stock_qty: parseFloat(form.stock) || 0,
    min_stock: parseFloat(form.min_stock) || 0,
  }
}

export default function Stock() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editProduct, setEditProduct] = useState(null) // product being edited
  const [showAddCat, setShowAddCat] = useState(false)
  const [editingStock, setEditingStock] = useState({})
  const [form, setForm] = useState(EMPTY_FORM)
  const [catName, setCatName] = useState('')
  const [filter, setFilter] = useState('')

  async function load() {
    const [cats, prods] = await Promise.all([api.getCategories(), api.getProducts()])
    setCategories(cats)
    setProducts(prods)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY_FORM)
    setShowAddProduct(true)
  }

  function openEdit(p) {
    setForm(productToForm(p))
    setEditProduct(p)
  }

  function closeForm() {
    setShowAddProduct(false)
    setEditProduct(null)
  }

  async function saveProduct() {
    const payload = formToPayload(form)
    if (editProduct) {
      await api.updateProduct(editProduct.id, payload)
    } else {
      await api.createProduct(payload)
    }
    closeForm()
    load()
  }

  async function saveCat() {
    if (!catName.trim()) return
    await api.createCategory({ name: catName.trim() })
    setCatName('')
    setShowAddCat(false)
    load()
  }

  async function updateStock(id, qty) {
    await api.updateProduct(id, { stock_qty: parseFloat(qty) || 0 })
    setEditingStock(prev => { const n = { ...prev }; delete n[id]; return n })
    load()
  }

  async function removeProduct(id) {
    if (!confirm('Remove this product?')) return
    await api.deleteProduct(id)
    load()
  }

  const filtered = products.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.category_name.toLowerCase().includes(filter.toLowerCase())
  )

  const grouped = categories.map(c => ({
    ...c,
    items: filtered.filter(p => p.category_id === c.id)
  })).filter(c => c.items.length > 0 || !filter)

  const formValid = form.name && form.category_id && form.price

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Stock & Products</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddCat(true)}>+ Category</button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Product</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search products..." style={{ maxWidth: 300 }} />
      </div>

      {grouped.map(cat => (
        <div key={cat.id} className="section">
          <div className="section-title">{cat.name}</div>
          {cat.items.length === 0 && <div className="empty-state">No products</div>}
          {cat.items.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Member price</th>
                    <th>Stock</th>
                    <th>Min stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{fmt(p.price_pence)}</td>
                      <td style={{ color: p.member_price_pence != null ? 'var(--success)' : 'var(--text-dim)' }}>
                        {p.member_price_pence != null ? fmt(p.member_price_pence) : '—'}
                      </td>
                      <td>
                        {editingStock[p.id] !== undefined ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              className="qty-input"
                              type="number"
                              step="0.5"
                              value={editingStock[p.id]}
                              onChange={e => setEditingStock(prev => ({ ...prev, [p.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && updateStock(p.id, editingStock[p.id])}
                              autoFocus
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => updateStock(p.id, editingStock[p.id])}>Save</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingStock(prev => { const n = { ...prev }; delete n[p.id]; return n })}>✕</button>
                          </div>
                        ) : (
                          <span
                            style={{ cursor: 'pointer', color: p.stock_qty <= p.min_stock && p.min_stock > 0 ? 'var(--danger)' : undefined }}
                            onClick={() => setEditingStock(prev => ({ ...prev, [p.id]: p.stock_qty }))}
                          >
                            {p.stock_qty}
                            {p.stock_qty <= p.min_stock && p.min_stock > 0 && <span className="badge badge-danger" style={{ marginLeft: 6 }}>Low</span>}
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-dim)' }}>{p.min_stock}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => removeProduct(p.id)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Add / Edit product modal */}
      {(showAddProduct || editProduct) && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="modal">
            <div className="modal-title">{editProduct ? `Edit — ${editProduct.name}` : 'Add product'}</div>
            <div className="field">
              <label>Name</label>
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Guinness"
              />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label>Price (£)</label>
                <input
                  type="number" step="0.01"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="3.50"
                />
              </div>
              <div className="field">
                <label>Member price (£) <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>optional</span></label>
                <input
                  type="number" step="0.01"
                  value={form.member_price}
                  onChange={e => setForm(f => ({ ...f, member_price: e.target.value }))}
                  placeholder="3.00"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label>Stock qty</label>
                <input
                  type="number" step="1"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="field">
                <label>Min stock alert</label>
                <input
                  type="number" step="1"
                  value={form.min_stock}
                  onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={saveProduct} disabled={!formValid}>
                {editProduct ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add category modal */}
      {showAddCat && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAddCat(false)}>
          <div className="modal">
            <div className="modal-title">Add category</div>
            <div className="field">
              <label>Name</label>
              <input
                autoFocus
                value={catName}
                onChange={e => setCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCat()}
                placeholder="e.g. Wines"
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddCat(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCat} disabled={!catName.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
