import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './AccountManager.css'

export default function AccountManager() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [authOpen, setAuthOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authMode, setAuthMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return undefined

    let mounted = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result =
        authMode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: { data: { display_name: displayName.trim() } },
            })

      if (result.error) throw result.error
      if (result.data.session) {
        setAuthOpen(false)
        setPassword('')
      } else if (authMode === 'sign-up') {
        setMessage('Check your email to confirm your account, then sign in.')
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Unable to complete the request.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return

    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.')
    }
  }

  async function openSettings() {
    if (!supabase || !session) return

    setError('')
    setMessage('')
    setDisplayName(session.user.user_metadata?.display_name || '')
    setDeleteConfirmation('')
    setSettingsLoading(true)
    setSettingsOpen(true)

    try {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('username, phone_number')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (profileError) throw profileError
      setUsername(data?.username || '')
      setPhone(data?.phone_number || '')
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : 'Unable to load account settings.')
    } finally {
      setSettingsLoading(false)
    }
  }

  async function saveDisplayName(event) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() },
      })
      if (updateError) throw updateError
      setMessage('Display name updated.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update display name.')
    } finally {
      setBusy(false)
    }
  }

  async function saveProfileField(field, value, successMessage) {
    if (!supabase || !session) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ user_id: session.user.id, [field]: value }, { onConflict: 'user_id' })
      if (updateError?.code === '23505') throw new Error('That username is already taken.')
      if (updateError) throw updateError
      setMessage(successMessage)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : `Unable to update ${field}.`)
    } finally {
      setBusy(false)
    }
  }

  async function saveUsername(event) {
    event.preventDefault()
    await saveProfileField('username', username.trim().toLowerCase(), 'Username updated.')
  }

  async function savePhoneNumber(event) {
    event.preventDefault()
    await saveProfileField('phone_number', phone.trim() || null, 'Phone number saved.')
  }

  async function savePassword(event) {
    event.preventDefault()
    if (!supabase) return
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update password.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount() {
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: deleteError } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      })
      if (deleteError) throw deleteError

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
      setSettingsOpen(false)
      setMessage('Account deleted.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete the account.')
    } finally {
      setBusy(false)
    }
  }

  function openAuth(mode = 'sign-in') {
    setAuthMode(mode)
    setMessage('')
    setError('')
    setAuthOpen(true)
  }

  return (
    <div className="account-manager">
      <div aria-live="polite" className="account-notices">
        {error && !authOpen && !settingsOpen && <p className="account-error">{error}</p>}
        {message && !authOpen && !settingsOpen && <p className="account-message">{message}</p>}
      </div>

      {!supabase ? (
        <p className="account-status">Add Supabase environment variables to enable accounts.</p>
      ) : authLoading ? (
        <p className="account-status" role="status">Checking session…</p>
      ) : session ? (
        <div className="account-controls">
          <span className="account-email">{session.user.email}</span>
          <button className="account-button secondary" onClick={openSettings} type="button">
            Account settings
          </button>
          <button className="account-button secondary" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      ) : (
        <button className="account-button" onClick={() => openAuth()} type="button">Sign in</button>
      )}

      {authOpen && supabase && (
        <div className="account-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAuthOpen(false)
        }}>
          <section aria-labelledby="auth-title" aria-modal="true" className="account-dialog" role="dialog">
            <button aria-label="Close" className="account-close" onClick={() => setAuthOpen(false)} type="button">×</button>
            <h1 id="auth-title">{authMode === 'sign-in' ? 'Sign in' : 'Create account'}</h1>
            <form className="account-form" onSubmit={handleAuthSubmit}>
              {authMode === 'sign-up' && (
                <label>
                  Display name
                  <input autoComplete="nickname" maxLength={40} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
                </label>
              )}
              <label>
                Email
                <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              </label>
              <label>
                Password
                <input autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'} minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              </label>
              {error && <p aria-live="polite" className="account-error">{error}</p>}
              {message && <p aria-live="polite" className="account-message">{message}</p>}
              <button className="account-button submit" disabled={busy} type="submit">
                {busy ? 'Please wait…' : authMode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <p className="account-switch">
              {authMode === 'sign-in' ? 'New here?' : 'Already have an account?'}{' '}
              <button className="account-link" onClick={() => {
                setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')
                setError('')
                setMessage('')
              }} type="button">
                {authMode === 'sign-in' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </section>
        </div>
      )}

      {settingsOpen && session && supabase && (
        <div className="account-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false)
        }}>
          <section aria-labelledby="settings-title" aria-modal="true" className="account-dialog settings-dialog" role="dialog">
            <button aria-label="Close account settings" className="account-close" onClick={() => setSettingsOpen(false)} type="button">×</button>
            <h1 id="settings-title">Account settings</h1>
            {settingsLoading ? (
              <p className="account-status" role="status">Loading account…</p>
            ) : (
              <div className="settings-content">
                <form className="account-form settings-section" onSubmit={saveDisplayName}>
                  <label>
                    Display name
                    <input autoComplete="nickname" maxLength={40} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
                  </label>
                  <button className="account-button submit" disabled={busy} type="submit">Save display name</button>
                </form>
                <form className="account-form settings-section" onSubmit={saveUsername}>
                  <label>
                    Username
                    <span className="field-hint">Unique, lowercase; 3–24 letters, numbers, or underscores.</span>
                    <input autoComplete="username" maxLength={24} minLength={3} onChange={(event) => setUsername(event.target.value)} pattern="[a-zA-Z0-9_]{3,24}" required value={username} />
                  </label>
                  <button className="account-button submit" disabled={busy} type="submit">Save username</button>
                </form>
                <form className="account-form settings-section" onSubmit={savePhoneNumber}>
                  <label>
                    Phone number
                    <span className="field-hint">Stored privately in your profile; verification is not required.</span>
                    <input autoComplete="tel" onChange={(event) => setPhone(event.target.value)} type="tel" value={phone} />
                  </label>
                  <button className="account-button submit" disabled={busy} type="submit">Save phone number</button>
                </form>
                <form className="account-form settings-section" onSubmit={savePassword}>
                  <label>
                    New password
                    <input autoComplete="new-password" minLength={6} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
                  </label>
                  <label>
                    Confirm new password
                    <input autoComplete="new-password" minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
                  </label>
                  <button className="account-button submit" disabled={busy} type="submit">Change password</button>
                </form>
                {error && <p aria-live="polite" className="account-error">{error}</p>}
                {message && <p aria-live="polite" className="account-message">{message}</p>}
                <section aria-labelledby="delete-title" className="delete-section">
                  <h2 id="delete-title">Delete account</h2>
                  <p>This permanently deletes your account and cannot be undone.</p>
                  <label>
                    Type DELETE to confirm
                    <input autoComplete="off" onChange={(event) => setDeleteConfirmation(event.target.value)} value={deleteConfirmation} />
                  </label>
                  <button className="account-button delete-button" disabled={busy || deleteConfirmation !== 'DELETE'} onClick={deleteAccount} type="button">
                    Permanently delete account
                  </button>
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
