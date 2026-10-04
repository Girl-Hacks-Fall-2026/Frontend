import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { supabase } from './lib/supabase'
import modelPath from './assets/fireball.glb'
import './App.css'

function Model(props) {
  const gltf = useGLTF(modelPath)
  return <primitive {...props} object={gltf.scene} />
}

export default function App() {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      setError('')
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(event) {
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

      if (result.error) {
        setError(result.error.message)
      } else if (result.data.session) {
        setAuthOpen(false)
        setPassword('')
      } else if (authMode === 'sign-up') {
        setMessage('Check your email to confirm your account, then sign in.')
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to complete the request.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return

    setError('')
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) setError(signOutError.message)
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

  async function saveUsername(event) {
    event.preventDefault()
    if (!supabase || !session) return

    const normalizedUsername = username.trim().toLowerCase()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: updateError } = await supabase.from('profiles').upsert(
        { user_id: session.user.id, username: normalizedUsername },
        { onConflict: 'user_id' },
      )
      if (updateError?.code === '23505') {
        throw new Error('That username is already taken.')
      }
      if (updateError) throw updateError
      setUsername(normalizedUsername)
      setMessage('Username updated.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update username.')
    } finally {
      setBusy(false)
    }
  }

  async function savePhoneNumber(event) {
    event.preventDefault()
    if (!supabase || !session) return

    setBusy(true)
    setError('')
    setMessage('')
    try {
      const { error: updateError } = await supabase.from('profiles').upsert(
        {
          user_id: session.user.id,
          username: username.trim().toLowerCase() || null,
          phone_number: phone.trim() || null,
        },
        { onConflict: 'user_id' },
      )
      if (updateError) throw updateError
      setMessage('Phone number saved.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to save phone number.')
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
    <main className="app">
      <header className="auth-bar">
        {error && !authOpen && <p aria-live="polite" className="auth-error">{error}</p>}
        {message && !authOpen && !settingsOpen && (
          <p aria-live="polite" className="auth-message">{message}</p>
        )}
        {!supabase ? (
          <p className="auth-status">Add Supabase environment variables to enable accounts.</p>
        ) : authLoading ? (
          <p className="auth-status" role="status">Checking session…</p>
        ) : session ? (
          <div className="session-controls">
            <span className="session-email">{session.user.email}</span>
            <button className="auth-button secondary" onClick={openSettings} type="button">
              Account settings
            </button>
            <button className="auth-button secondary" onClick={handleSignOut} type="button">
              Sign out
            </button>
          </div>
        ) : (
          <button className="auth-button" onClick={() => openAuth()} type="button">
            Sign in
          </button>
        )}
      </header>

      <section aria-label="Your 3D world" className="world">
        <Canvas>
          <ambientLight />
          <Suspense fallback={null}>
            <Model />
          </Suspense>
        </Canvas>
      </section>

      {authOpen && supabase && (
        <div
          className="auth-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAuthOpen(false)
          }}
        >
          <section aria-labelledby="auth-title" aria-modal="true" className="auth-dialog" role="dialog">
            <button
              aria-label="Close"
              className="auth-close"
              onClick={() => setAuthOpen(false)}
              type="button"
            >
              ×
            </button>
            <h1 id="auth-title">{authMode === 'sign-in' ? 'Sign in' : 'Create account'}</h1>
            <form className="auth-form" onSubmit={handleSubmit}>
              {authMode === 'sign-up' && (
                <label>
                  Display name
                  <input
                    autoComplete="nickname"
                    maxLength={40}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    value={displayName}
                  />
                </label>
              )}
              <label>
                Email
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              {error && <p aria-live="polite" className="auth-error">{error}</p>}
              {message && <p aria-live="polite" className="auth-message">{message}</p>}
              <button className="auth-button submit" disabled={busy} type="submit">
                {busy ? 'Please wait…' : authMode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <p className="auth-switch">
              {authMode === 'sign-in' ? 'New here?' : 'Already have an account?'}{' '}
              <button
                className="auth-link"
                onClick={() => {
                  setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')
                  setError('')
                  setMessage('')
                }}
                type="button"
              >
                {authMode === 'sign-in' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </section>
        </div>
      )}

      {settingsOpen && session && supabase && (
        <div
          className="auth-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false)
          }}
        >
          <section aria-labelledby="settings-title" aria-modal="true" className="settings-dialog" role="dialog">
            <button
              aria-label="Close account settings"
              className="auth-close"
              onClick={() => setSettingsOpen(false)}
              type="button"
            >
              ×
            </button>
            <h1 id="settings-title">Account settings</h1>
            {settingsLoading ? (
              <p className="auth-status" role="status">Loading account…</p>
            ) : (
              <div className="settings-content">
                <form className="auth-form settings-section" onSubmit={saveDisplayName}>
                  <label>
                    Display name
                    <input
                      autoComplete="nickname"
                      maxLength={40}
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                      value={displayName}
                    />
                  </label>
                  <button className="auth-button submit" disabled={busy} type="submit">Save display name</button>
                </form>

                <form className="auth-form settings-section" onSubmit={saveUsername}>
                  <label>
                    Username
                    <span className="field-hint">Unique, lowercase; 3–24 letters, numbers, or underscores.</span>
                    <input
                      autoComplete="username"
                      maxLength={24}
                      minLength={3}
                      onChange={(event) => setUsername(event.target.value)}
                      pattern="[a-zA-Z0-9_]{3,24}"
                      required
                      value={username}
                    />
                  </label>
                  <button className="auth-button submit" disabled={busy} type="submit">Save username</button>
                </form>

                <form className="auth-form settings-section" onSubmit={savePhoneNumber}>
                  <label>
                    Phone number
                    <span className="field-hint">Stored privately in your profile; verification is not required.</span>
                    <input
                      autoComplete="tel"
                      onChange={(event) => setPhone(event.target.value)}
                      type="tel"
                      value={phone}
                    />
                  </label>
                  <button className="auth-button submit" disabled={busy} type="submit">Save phone number</button>
                </form>

                <form
                  className="auth-form settings-section"
                  onSubmit={async (event) => {
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
                  }}
                >
                  <label>
                    New password
                    <input
                      autoComplete="new-password"
                      minLength={6}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                      type="password"
                      value={newPassword}
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      autoComplete="new-password"
                      minLength={6}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      type="password"
                      value={confirmPassword}
                    />
                  </label>
                  <button className="auth-button submit" disabled={busy} type="submit">Change password</button>
                </form>

                {error && <p aria-live="polite" className="auth-error">{error}</p>}
                {message && <p aria-live="polite" className="auth-message">{message}</p>}

                <section aria-labelledby="delete-title" className="delete-section">
                  <h2 id="delete-title">Delete account</h2>
                  <p>This permanently deletes your account and cannot be undone.</p>
                  <label>
                    Type DELETE to confirm
                    <input
                      autoComplete="off"
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      value={deleteConfirmation}
                    />
                  </label>
                  <button
                    className="auth-button delete-button"
                    disabled={busy || deleteConfirmation !== 'DELETE'}
                    onClick={deleteAccount}
                    type="button"
                  >
                    Permanently delete account
                  </button>
                </section>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
