import React from "react";
import { Repeat } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import PageHeader from "../PageHeader";

export default function Rotinas() {
  const { colors } = useTheme();
  return (
    <div className="flex flex-col h-full">
      <PageHeader icon={Repeat} title="Rotinas" subtitle="Tarefas recorrentes e sua repetição automática" />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Repeat size={32} className="mx-auto mb-3" style={{ color: colors.textSecondary }} />
          <div className="text-[13px] font-medium mb-1" style={{ color: colors.textPrimary }}>
            Em construção
          </div>
          <div className="text-[12px]" style={{ color: colors.textSecondary }}>
            Essa página ganha conteúdo na Etapa 6.
          </div>
        </div>
      </div>
    </div>
  );
}
