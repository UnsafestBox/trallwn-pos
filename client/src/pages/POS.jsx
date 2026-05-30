import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../api/index.js'

function fmt(pence) {
  return `£${(pence / 100).toFixed(2)}`
}

let nextId = 1

// Quick sale items live only in state until settled — no tab created until payment
function useQuickSale() {
  const [items, setItems] = useState([])

  function addItem(product, isMember = false) {
    const price = (isMember && product.member_price_pence != null)
      ? product.member_price_pence
      : product.price_pence
    setItems(prev => [...prev, {
      _id: nextId++,
      product_id: product.id,
      product_name: product.name,
      unit_price_pence: price,
      is_member: isMember && product.member_price_pence != null,
      quantity: 1,
    }])
  }

  function removeItem(_id) {
    setItems(prev => prev.filter(i => i._id !== _id))
  }

  function reprice(products, isMember) {
    const lookup = Object.fromEntries(products.map(p => [p.id, p]))
    setItems(prev => prev.map(item => {
      const product = lookup[item.product_id]
      if (!product) return item
      const asMember = isMember && product.member_price_pence != null
      return {
        ...item,
        unit_price_pence: asMember ? product.member_price_pence : product.price_pence,
        is_member: asMember,
      }
    }))
  }

  function clear() { setItems([]) }

  const total = items.reduce((s, i) => s + i.unit_price_pence, 0)

  return { items, addItem, removeItem, reprice, clear, total }
}

export default function POS() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [mode, setMode] = useState('quick') // 'quick' | 'tab'

  // Tab mode state
  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [tabDetail, setTabDetail] = useState(null)
  const [showNewTab, setShowNewTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [tabLoading, setTabLoading] = useState(false)

  // Shared settle state
  const [showClose, setShowClose] = useState(false)
  const [payMethod, setPayMethod] = useState('card')
  const [settling, setSettling] = useState(false)
  const [isMember, setIsMember] = useState(false)

  const qs = useQuickSale()

  const loadBase = useCallback(async () => {
    const [cats, prods, openTabs] = await Promise.all([
      api.getCategories(), api.getProducts(), api.getTabs('open')
    ])
    setCategories(cats)
    setProducts(prods)
    setActiveCat(prev => prev ?? cats[0]?.id ?? null)
    setTabs(openTabs)
  }, [])

  const loadTab = useCallback(async (id) => {
    if (!id) { setTabDetail(null); return }
    const t = await api.getTab(id)
    setTabDetail(t)
  }, [])

  useEffect(() => { loadBase() }, [loadBase])
  useEffect(() => { loadTab(activeTabId) }, [activeTabId, loadTab])

  const visibleProducts = activeCat
    ? products.filter(p => p.category_id === activeCat)
    : products

  function handleProductClick(product) {
    if (mode === 'quick') {
      qs.addItem(product, isMember)
    } else {
      addToTab(product)
    }
  }

  // --- Tab mode actions ---

  async function addToTab(product) {
    if (!activeTabId) { setShowNewTab(true); return }
    setTabLoading(true)
    try {
      await api.addItem(activeTabId, product.id, 1, isMember)
      await Promise.all([loadTab(activeTabId), loadBase()])
    } finally { setTabLoading(false) }
  }

  async function removeTabItem(itemId) {
    await api.removeItem(activeTabId, itemId)
    await Promise.all([loadTab(activeTabId), loadBase()])
  }

  async function createTab() {
    if (!newTabName.trim()) return
    const t = await api.createTab(newTabName.trim())
    setNewTabName('')
    setShowNewTab(false)
    await loadBase()
    setActiveTabId(t.id)
  }

  async function voidTab() {
    if (!confirm('Void this tab and restore stock?')) return
    await api.deleteTab(activeTabId)
    setActiveTabId(null)
    setTabDetail(null)
    await loadBase()
  }

  // --- Settle (both modes) ---

  async function settle() {
    setSettling(true)
    try {
      if (mode === 'quick') {
        const now = new Date()
        const label = `Quick Sale ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
        const tab = await api.createTab(label)
        for (const item of qs.items) {
          await api.addItem(tab.id, item.product_id, 1, item.is_member)
        }
        await api.closeTab(tab.id, payMethod)
        qs.clear()
      } else {
        await api.closeTab(activeTabId, payMethod)
        setActiveTabId(null)
        setTabDetail(null)
      }
      setShowClose(false)
      await loadBase()
    } finally { setSettling(false) }
  }

  const canSettle = mode === 'quick' ? qs.items.length > 0 : tabDetail?.items.length > 0
  const settleTotal = mode === 'quick' ? qs.total : tabDetail?.total_pence ?? 0
  const settleLabel = mode === 'quick' ? 'Quick Sale' : tabDetail?.name

  return (
    <div className="pos-layout">
      {/* Left: menu */}
      <div className="pos-menu">
        <div className="pos-categories">
          {categories.map(c => (
            <button
              key={c.id}
              className={`cat-btn${activeCat === c.id ? ' active' : ''}`}
              onClick={() => setActiveCat(c.id)}
            >{c.name}</button>
          ))}
        </div>
        <div className="pos-products">
          {visibleProducts.map(p => {
            const activePrice = (isMember && p.member_price_pence != null) ? p.member_price_pence : p.price_pence
            const hasMemberPrice = p.member_price_pence != null
            return (
              <button
                key={p.id}
                className={`product-btn${p.stock_qty <= p.min_stock && p.min_stock > 0 ? ' low-stock' : ''}`}
                onClick={() => handleProductClick(p)}
                disabled={tabLoading}
              >
                <span className="product-name">{p.name}</span>
                <span className="product-price">{fmt(activePrice)}</span>
                {isMember && hasMemberPrice && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>member price</span>
                )}
                {!isMember && hasMemberPrice && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>mbr: {fmt(p.member_price_pence)}</span>
                )}
                {p.min_stock > 0 && (
                  <span className={`product-stock${p.stock_qty <= p.min_stock ? ' warn' : ''}`}>
                    Stock: {p.stock_qty}
                  </span>
                )}
              </button>
            )
          })}
          {visibleProducts.length === 0 && (
            <div className="empty-state">No products in this category</div>
          )}
        </div>
      </div>

      {/* Right: panel */}
      <div className="tab-panel">
        {/* Mode switcher */}
        <div className="tab-panel-header" style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`btn btn-sm ${mode === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setMode('quick')}
            >Quick Sale</button>
            <button
              className={`btn btn-sm ${mode === 'tab' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setMode('tab')}
            >Tab</button>
          </div>
          <button
            className={`btn btn-sm ${isMember ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              const next = !isMember
              setIsMember(next)
              if (mode === 'quick') {
                qs.reprice(products, next)
              } else if (activeTabId) {
                api.repriceTab(activeTabId, next).then(() => loadTab(activeTabId))
              }
            }}
            style={{ width: '100%' }}
          >{isMember ? '★ Member pricing active' : '☆ Non-member pricing'}</button>

          {mode === 'tab' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="tab-select"
                value={activeTabId ?? ''}
                onChange={e => setActiveTabId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- Select tab --</option>
                {tabs.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({fmt(t.total_pence)})</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewTab(true)}>+ New</button>
            </div>
          )}
        </div>

        {/* Quick sale items */}
        {mode === 'quick' && (
          <>
            <div className="tab-items">
              {qs.items.length === 0 && (
                <div className="tab-empty">Tap a product to add it</div>
              )}
              {qs.items.map(item => (
                <div key={item._id} className="tab-item">
                  <span className="tab-item-name">{item.product_name}</span>
                  <span className="tab-item-qty">×1</span>
                  {item.is_member && <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>M</span>}
                  <span className="tab-item-price">{fmt(item.unit_price_pence)}</span>
                  <button className="tab-item-remove" onClick={() => qs.removeItem(item._id)}>✕</button>
                </div>
              ))}
            </div>
            <div className="tab-footer">
              <div className="tab-total">
                <span className="tab-total-label">Total</span>
                <span className="tab-total-amount">{fmt(qs.total)}</span>
              </div>
              <div className="tab-actions">
                <button className="btn btn-secondary btn-sm" onClick={qs.clear} disabled={qs.items.length === 0}>Clear</button>
                <button
                  className="btn btn-success btn-lg"
                  style={{ flex: 1 }}
                  onClick={() => setShowClose(true)}
                  disabled={!canSettle}
                >Charge {fmt(qs.total)}</button>
              </div>
            </div>
          </>
        )}

        {/* Tab items */}
        {mode === 'tab' && (
          tabDetail ? (
            <>
              <div className="tab-items">
                {tabDetail.items.length === 0 && (
                  <div className="tab-empty">Tab is empty — tap a product to add</div>
                )}
                {tabDetail.items.map(item => (
                  <div key={item.id} className="tab-item">
                    <span className="tab-item-name">{item.product_name}</span>
                    <span className="tab-item-qty">×{item.quantity}</span>
                    {item.is_member === 1 && <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>M</span>}
                    <span className="tab-item-price">{fmt(item.unit_price_pence * item.quantity)}</span>
                    <button className="tab-item-remove" onClick={() => removeTabItem(item.id)}>✕</button>
                  </div>
                ))}
              </div>
              <div className="tab-footer">
                <div className="tab-total">
                  <span className="tab-total-label">Total</span>
                  <span className="tab-total-amount">{fmt(tabDetail.total_pence)}</span>
                </div>
                <div className="tab-actions">
                  <button className="btn btn-danger btn-sm" onClick={voidTab}>Void</button>
                  <button
                    className="btn btn-success btn-lg"
                    style={{ flex: 1 }}
                    onClick={() => setShowClose(true)}
                    disabled={!canSettle}
                  >Settle {fmt(tabDetail.total_pence)}</button>
                </div>
              </div>
            </>
          ) : (
            <div className="tab-empty">Select or create a tab to start</div>
          )
        )}
      </div>

      {/* New tab modal */}
      {showNewTab && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowNewTab(false)}>
          <div className="modal">
            <div className="modal-title">Open new tab</div>
            <div className="field">
              <label>Tab name (e.g. Table 3, John)</label>
              <input
                autoFocus
                value={newTabName}
                onChange={e => setNewTabName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTab()}
                placeholder="Name..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewTab(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createTab} disabled={!newTabName.trim()}>Open tab</button>
            </div>
          </div>
        </div>
      )}

      {/* Settle modal */}
      {showClose && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowClose(false)}>
          <div className="modal">
            <div className="modal-title">{mode === 'quick' ? 'Quick Sale' : `Settle: ${settleLabel}`}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 20 }}>{fmt(settleTotal)}</div>
            <div className="field">
              <label>Payment method</label>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {['card', 'cash'].map(m => (
                  <button
                    key={m}
                    className={`btn btn-lg ${payMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setPayMethod(m)}
                  >{m.charAt(0).toUpperCase() + m.slice(1)}</button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClose(false)} disabled={settling}>Cancel</button>
              <button className="btn btn-success" onClick={settle} disabled={settling}>
                {settling ? 'Processing...' : 'Confirm payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
