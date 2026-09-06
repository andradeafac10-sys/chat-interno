import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import RequireAdmin from "./gestao/RequireAdmin";
import GestaoApp from "./gestao/GestaoApp";
import VisaoGeral from "./gestao/pages/VisaoGeral";
import MinhaRotina from "./gestao/pages/MinhaRotina";
import Tarefas from "./gestao/pages/Tarefas";
import Rotinas from "./gestao/pages/Rotinas";
import GestaoFeedbacks from "./gestao/pages/Feedbacks";
import GestaoTrilha from "./gestao/pages/Trilha";
import Reuniao from "./gestao/pages/Reuniao";

// Mesmo comportamento de sempre: se está logado mostra o Chat, senão a tela de login.
// Isso NÃO mudou — só passou a viver dentro da rota "/*" em vez de ser tudo o que existia.
function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-slate-400 text-sm" style={{ background: "#111B21" }}>
        Carregando...
      </div>
    );
  }
  return user ? <Chat /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* /gestao — só ADM entra; RequireAdmin manda de volta pro chat quem não pode.
                GestaoApp é o layout (menu lateral); cada item do menu é uma rota-filha própria. */}
            <Route
              path="/gestao"
              element={
                <RequireAdmin>
                  <GestaoApp />
                </RequireAdmin>
              }
            >
              <Route index element={<VisaoGeral />} />
              <Route path="minha-rotina" element={<MinhaRotina />} />
              <Route path="tarefas" element={<Tarefas />} />
              <Route path="rotinas" element={<Rotinas />} />
              <Route path="feedbacks" element={<GestaoFeedbacks />} />
              <Route path="trilha" element={<GestaoTrilha />} />
              <Route path="reuniao" element={<Reuniao />} />
            </Route>

            {/* Qualquer outro caminho continua sendo o Chat de sempre, sem nenhuma mudança */}
            <Route path="/*" element={<Gate />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
