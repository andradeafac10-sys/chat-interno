import React from "react";
import { LayoutDashboard, AlertTriangle, Activity } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import PageHeader from "../PageHeader";

const CARDS = [
  { label: "Tarefas hoje" },
  { label: "Concluídas hoje" },
  { label: "Em andamento" },
  { label: "Pendentes" },
  { label: "Atrasadas" },
  { label: "Conclusão do dia" },
];

function Card({ label, colors }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: colors.panelBg, borderColor: colors.border }}>
      <div className="text-[12px] mb-2" style={{ color: colors.textSecondary }}>{label}</div>
      <div className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>—</div>
    </div>
  );
}

export default function VisaoGeral() {
  const { colors } = useTheme();

  return (
    <div className="flex flex-col h-full">
      <PageHeader icon={LayoutDashboard} title="Visão Geral" subtitle="Panorama do dia da equipe" />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Cards principais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CARDS.map((c) => <Card key={c.label} label={c.label} colors={colors} />)}
        </div>

        {/* Resumo da equipe */}
        <div className="rounded-xl border overflow-hidden" style={{ background: colors.panelBg, borderColor: colors.border }}>
          <div className="px-4 py-3 border-b text-[13px] font-semibold" style={{ borderColor: colors.border, color: colors.textPrimary }}>
            Resumo da equipe
          </div>
          <div className="p-6 text-center text-[13px]" style={{ color: colors.textSecondary }}>
            Ainda não há tarefas cadastradas para mostrar aqui.
          </div>
        </div>

        {/* Atenção necessária */}
        <div className="rounded-xl border overflow-hidden" style={{ background: colors.panelBg, borderColor: colors.border }}>
          <div className="px-4 py-3 border-b text-[13px] font-semibold flex items-center gap-2" style={{ borderColor: colors.border, color: colors.textPrimary }}>
            <AlertTriangle size={15} className="text-amber-500" /> Atenção necessária
          </div>
          <div className="p-6 text-center text-[13px]" style={{ color: colors.textSecondary }}>
            Nenhuma pendência crítica no momento.
          </div>
        </div>

        {/* Atividade recente */}
        <div className="rounded-xl border overflow-hidden" style={{ background: colors.panelBg, borderColor: colors.border }}>
          <div className="px-4 py-3 border-b text-[13px] font-semibold flex items-center gap-2" style={{ borderColor: colors.border, color: colors.textPrimary }}>
            <Activity size={15} className="text-[#2E6FD9]" /> Atividade recente
          </div>
          <div className="p-6 text-center text-[13px]" style={{ color: colors.textSecondary }}>
            Nenhuma atividade registrada ainda.
          </div>
        </div>
      </div>
    </div>
  );
}
