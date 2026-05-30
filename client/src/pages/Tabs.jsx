import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/index.js'

function fmt(pence) { return `£${(pence / 100).toFixed(2)}` }

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z')) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  return `${Math.floor(diff / 60)}h ${diff % 60}m ago`
}

export default function Tabs() {
  const [view, setView] = useState('open')
  const [tabs, setTabs] = useState([])
  const [selected, setSelected] = useState(null)
  const [showClose, setShowClose] = useState(false)
  const [payMethod, setPayMethod] = useState('card')
  const navigate = useNavigate()

  async function load() {
    const data = await api.getTabs(view)
    setTabs(data)
    setSelected(null)
  }

  useEffect(() => { load() }, [view])

  async function loadDetail(id) {
    const t = await api.getTab(id)
    setSelected(t)
  }

  async function closeTab() {
    await api.closeTab(selected.id, payMethod)
    setShowClose(false)
    setSelected(null)
    load()
  }

  async function voidTab() {
    if (!confirm('Void this tab?')) return
    await api.deleteTab(selected.id)
    setSelected(null)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">Tabs</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {['open', 'closed'].map(v => (
            <button key={v} className={`btn ${view === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {tabs.length === 0 && <div className="empty-state">No {view} tabs</div>}

      <div className="tabs-grid">
        {tabs.map(t => (
          <div key={t.id} className="card tab-card" onClick={() => loadDetail(t.id)}>
            <div className="tab-card-name">{t.name}</div>
            <div className="tab-card-time">{timeAgo(t.opened_at)}</div>
            <div className="tab-card-total">{fmt(t.total_pence)}</div>
            {t.payment_method && <div className="tab-card-count" style={{ marginTop: 4 }}>{t.payment_method}</div>}
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-title">{selected.name}</div>
            {selected.items.length === 0 && <div className="empty-state">Empty tab</div>}
            <div style={{ marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
              {selected.items.map(item => (
                <div key={item.id} className="tab-item" style={{ marginBottom: 6 }}>
                  <span className="tab-item-name">{item.product_name}</span>
                  <span className="tab-item-qty">×{item.quantity}</span>
                  <span className="tab-item-price">{fmt(item.unit_price_pence * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="tab-total" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span className="tab-total-label">Total</span>
              <span className="tab-total-amount">{fmt(selected.total_pence)}</span>
            </div>
            {selected.status === 'open' ? (
              <div className="modal-footer">
                <button className="btn btn-danger btn-sm" onClick={voidTab}>Void</button>
                <button className="btn btn-secondary" onClick={() => { setSelected(null); navigate('/') }}>Add items</button>
                <button className="btn btn-success" onClick={() => setShowClose(true)} disabled={selected.items.length === 0}>
                  Settle
                </button>
              </div>
            ) : (
              <div className="modal-footer">
                <div className="badge badge-success">Settled · {selected.payment_method}</div>
                <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showClose && selected && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowClose(false)}>
          <div className="modal">
            <div className="modal-title">Settle: {selected.name}</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 20 }}>{fmt(selected.total_pence)}</div>
            <div className="field">
              <label>Payment method</label>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {['card', 'cash'].map(m => (
                  <button key={m} className={`btn btn-lg ${payMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }} onClick={() => setPayMethod(m)}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowClose(false)}>Cancel</button>
              <button className="btn btn-success" onClick={closeTab}>Confirm payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
