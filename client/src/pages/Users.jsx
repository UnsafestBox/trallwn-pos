import React, { useState, useEffect } from 'react'
import { api } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'

function fmtDateTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr + 'Z')
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

const EMPTY_FORM = { name: '', pin: '', confirmPin: '', role: 'normal' }

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  async function load() {
    setUsers(await api.getUsers())
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(EMPTY_FORM)
    setError('')
    setShowAdd(true)
  }

  function openEdit(u) {
    setForm({ name: u.name, pin: '', confirmPin: '', role: u.role })
    setError('')
    setEditUser(u)
  }

  function close() {
    setShowAdd(false)
    setEditUser(null)
    setError('')
  }

  async function save() {
    setError('')
    if (!form.name.trim()) return setError('Name is required')
    if (!editUser && !form.pin) return setError('PIN is required')
    if (form.pin && form.pin !== form.confirmPin) return setError('PINs do not match')
    if (form.pin && !/^\d{4,6}$/.test(form.pin)) return setError('PIN must be 4–6 digits')

    try {
      if (editUser) {
        const payload = { name: form.name, role: form.role }
        if (form.pin) payload.pin = form.pin
        await api.updateUser(editUser.id, payload)
      } else {
        await api.createUser({ name: form.name.trim(), pin: form.pin, role: form.role })
      }
      close()
      load()
    } catch (e) {
      setError(e.message || 'Failed to save')
    }
  }

  async function toggleActive(u) {
    const newActive = u.active ? 0 : 1
    try {
      await api.updateUser(u.id, { active: newActive })
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  const f = (k) => (e) => { setForm(prev => ({ ...prev, [k]: e.target.value })); setError('') }

  return (
    <div className="page">
      <div className="page-header">
        <span className="page-title">User Accounts</span>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add user</button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="stock-table">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  {u.name}
                  {u.id === currentUser?.id && (
                    <span className="badge badge-success" style={{ marginLeft: 8 }}>You</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${u.role === 'super' ? 'badge-warn' : ''}`}
                    style={u.role !== 'super' ? { color: 'var(--text-dim)' } : {}}>
                    {u.role === 'super' ? 'Super' : 'Normal'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.active ? 'badge-success' : 'badge-danger'}`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {fmtDateTime(u.created_at)}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                    {u.id !== currentUser?.id && (
                      <button
                        className={`btn btn-sm ${u.active ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showAdd || editUser) && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && close()}>
          <div className="modal">
            <div className="modal-title">{editUser ? `Edit — ${editUser.name}` : 'Add user'}</div>

            <div className="field">
              <label>Name</label>
              <input autoFocus value={form.name} onChange={f('name')} placeholder="e.g. Sarah" />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={f('role')}>
                <option value="normal">Normal — POS only</option>
                <option value="super">Super — full access</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label>{editUser ? 'New PIN (leave blank to keep)' : 'PIN'}</label>
                <input type="password" inputMode="numeric" maxLength={6} value={form.pin} onChange={f('pin')} placeholder="4–6 digits" />
              </div>
              <div className="field">
                <label>Confirm PIN</label>
                <input type="password" inputMode="numeric" maxLength={6} value={form.confirmPin} onChange={f('confirmPin')} placeholder="repeat PIN" />
              </div>
            </div>
            {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 8 }}>{error}</div>}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={close}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>
                {editUser ? 'Save changes' : 'Add user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
