import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "../api";

// Aviso "🔔 TREINAMENTO PENDENTE" na tela inicial do chat — pra ADM e
// Operador igual. Some sozinho quando termina tudo, volta a aparecer quando
// atribuem um treinamento novo.
export default function TreinamentoPendenteBanner({ onVerTreinamentos }) {
  const [count, setCount] = useState(0);

  const carregar = () => {
    api.get("/trilha/pendentes-count").then(({ data }) => setCount(data.count)).catch(() => {});
  };

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30000);
    window.addEventListener("rotina:atualizada", carregar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("rotina:atualizada", carregar);
    };
  }, []);

  if (count === 0) return null;

  return (
    <div className="mx-3 mt-3 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#FEF2F2", border: "1px solid #FCA5A5" }}>
      <Bell size={18} className="text-red-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-bold text-red-600">TREINAMENTO PENDENTE</div>
        <div className="text-[12px] text-red-500">Você possui {count} treinamento{count > 1 ? "s" : ""} pendente{count > 1 ? "s" : ""}.</div>
      </div>
      <button
        onClick={onVerTreinamentos}
        className="text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 shrink-0"
        style={{ background: "#DC2626" }}
      >
        VER TREINAMENTOS
      </button>
    </div>
  );
}
