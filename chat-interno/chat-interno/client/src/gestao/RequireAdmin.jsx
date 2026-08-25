import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Só deixa passar se a pessoa estiver logada E for ADM.
 * Protege /gestao mesmo se alguém tentar acessar a URL direto,
 * sem depender só de esconder o botão na tela.
 */
export default function RequireAdmin({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center text-slate-400 text-sm" style={{ background: "#0A1628" }}>
        Carregando...
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}
