import { Navigate, Route, Routes } from 'react-router-dom'
import AudioControls from './components/AudioControls'
import Header from './components/Header'
import BaccaratPage from './pages/BaccaratPage'
import BlackjackPage from './pages/BlackjackPage'
import CrapsPage from './pages/CrapsPage'
import LobbyPage from './pages/LobbyPage'
import RoulettePage from './pages/RoulettePage'
import SlotsPage from './pages/SlotsPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <>
      <Header />
      <Routes>
  <Route path="/" element={<LobbyPage />} />
        <Route path="/game/slots" element={<SlotsPage />} />
        <Route path="/game/roulette" element={<RoulettePage />} />
        <Route path="/game/baccarat" element={<BaccaratPage />} />
        <Route path="/game/blackjack" element={<BlackjackPage />} />
        <Route path="/game/craps" element={<CrapsPage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AudioControls />
    </>
  )
}

export default App
