import './App.css';
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Chat from './Chat';
import Login from './Login';
import GestaoApp from './gestao/GestaoApp';
import VisaoGeral from './gestao/pages/VisaoGeral';
import MinhaRotina from './gestao/pages/MinhaRotina';
import Tarefas from './gestao/pages/Tarefas';
import GestaoTarefasEquipe from './gestao/pages/PainelEquipe';
import GestaoFeedbacks from './gestao/pages/Feedbacks';
import GestaoTrilha from './gestao/pages/Trilha';
import Reuniao from './gestao/pages/Reuniao';

// Importar Dashboard apenas se existir
let Dashboard = null;
try {
  Dashboard = require('./gestao/pages/Dashboard').default;
} catch (e) {
  console.warn('Dashboard não encontrado, pulando import');
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const socket = React.useRef(null);

  useEffect(() => {
    const verificarLogin = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.ok) {
          const user = await res.json();
          setUsuario(user);
          inicializarSocket(user);
        }
      } catch (e) {
        console.error('Erro ao verificar login:', e);
      } finally {
        setCarregando(false);
      }
    };

    verificarLogin();
  }, []);

  const inicializarSocket = (user) => {
    const baseURL = import.meta.env.MODE === 'production' 
      ? 'https://chatinternonnc-api.up.railway.app'
      : 'http://localhost:3001';

    socket.current = io(baseURL, { auth: { token: user.token } });

    socket.current.on('connect', () => {
      console.log('✅ Socket conectado');
      socket.current.emit('user:online', { userId: user.id });
    });

    socket.current.on('disconnect', () => {
      console.log('❌ Socket desconectado');
    });
  };

  if (carregando) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;
  }

  if (!usuario) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/chat" element={<Chat socket={socket} usuario={usuario} />} />

        <Route
          path="/gestao"
          element={
            usuario.role === 'admin' ? (
              <GestaoApp usuario={usuario} />
            ) : (
              <Navigate to="/chat" replace />
            )
          }
        >
          <Route index element={<VisaoGeral />} />
          {Dashboard && <Route path="dashboard" element={<Dashboard />} />}
          <Route path="minha-rotina" element={<MinhaRotina />} />
          <Route path="tarefas" element={<Tarefas />} />
          <Route path="tarefas-equipe" element={<GestaoTarefasEquipe />} />
          <Route path="rotinas" element={<Rotinas />} />
          <Route path="feedbacks" element={<GestaoFeedbacks />} />
          <Route path="trilha" element={<GestaoTrilha />} />
          <Route path="reuniao" element={<Reuniao />} />
        </Route>

        <Route path="/" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
