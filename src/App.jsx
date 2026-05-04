import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PlayerProvider } from './context/PlayerContext.jsx'
import LoginPage from './pages/LoginPage.jsx'
import WorldPage from './pages/WorldPage.jsx'

function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/world" element={<WorldPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PlayerProvider>
  )
}

export default App