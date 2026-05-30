import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { GameProvider } from './contexts/GameContext';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import RoleReveal from './pages/RoleReveal';
import GameDay from './pages/GameDay';
import GameNight from './pages/GameNight';
import GameMorning from './pages/GameMorning';
import GameOver from './pages/GameOver';
import AppEvents from './components/AppEvents';

export default function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <GameProvider>
          <AppEvents />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/role-reveal" element={<RoleReveal />} />
            <Route path="/game/day" element={<GameDay />} />
            <Route path="/game/night" element={<GameNight />} />
            <Route path="/game/morning" element={<GameMorning />} />
            <Route path="/game/over" element={<GameOver />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GameProvider>
      </SocketProvider>
    </BrowserRouter>
  );
}
