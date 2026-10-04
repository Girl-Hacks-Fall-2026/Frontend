import AccountManager from './components/AccountManager.jsx'
import Game from './Game.jsx'
import './App.css'

export default function App() {
  return (
    <main className="app-shell">
      <Game />
      <AccountManager />
    </main>
  )
}
