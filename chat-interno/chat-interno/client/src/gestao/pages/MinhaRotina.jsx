import React from "react";
import { CalendarCheck } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import PageHeader from "../PageHeader";

export default function MinhaRotina() {
  const { colors } = useTheme();
  return (
    <div className="flex flex-col h-full">
      <PageHeader icon={CalendarCheck} title="Minha Rotina" subtitle="Suas tarefas de hoje, organizadas por horário" />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <CalendarCheck size={32} className="mx-auto mb-3" style={{ color: colors.textSecondary }} />
          <div className="text-[13px] font-medium mb-1" style={{ color: colors.textPrimary }}>
            Em construção
          </div>
          <div className="text-[12px]" style={{ color: colors.textSecondary }}>
            Essa página ganha conteúdo na Etapa 5.
          </div>
        </div>
      </div>
    </div>
  );
}
