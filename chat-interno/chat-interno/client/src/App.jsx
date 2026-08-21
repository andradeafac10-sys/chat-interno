import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Chat from "./pages/Chat";

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-slate-400 text-sm" style={{ background: "#0F1B2D" }}>
        Carregando...
      </div>
    );
  }
  return user ? <Chat /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
