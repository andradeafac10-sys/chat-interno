import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../api";

/**
 * Casca inicial do Painel Gestão Nacional (Etapa 1).
 * Só confirma que o acesso está funcionando; o conteúdo real
 * (dashboard, tarefas, equipe etc.) entra nas próximas etapas.
 */
export default function GestaoApp() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [pingMsg, setPingMsg] = React.useState("Verificando acesso ao servidor...");

  React.useEffect(() => {
    api.get("/gestao/ping")
      .then(({ data }) => setPingMsg(data.message))
      .catch(() => setPingMsg("Não foi possível confirmar o acesso ao servidor."));
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col" style={{ background: colors.chatBg }}>
      <div
        className="h-16 flex items-center gap-3 px-5 border-b shrink-0"
        style={{ background: colors.headerBg, borderColor: colors.headerBorder }}
      >
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border"
          style={{ color: colors.textPrimary, borderColor: colors.border }}
        >
          <ArrowLeft size={15} /> Voltar para o Chat
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <LayoutDashboard size={18} className="text-[#2E6FD9]" />
          <h1 className="text-base font-semibold" style={{ color: colors.textPrimary }}>
            Painel Gestão Nacional
          </h1>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm" style={{ color: colors.textSecondary }}>
            Acesso confirmado, {user?.name?.split(" ")[0]}.
          </div>
          <div className="text-xs mt-1 text-emerald-600">
            {pingMsg}
          </div>
          <div className="text-xs mt-3" style={{ color: colors.textSecondary }}>
            O conteúdo do painel (dashboard, tarefas, equipe...) chega nas próximas etapas.
          </div>
        </div>
      </div>
    </div>
  );
}
