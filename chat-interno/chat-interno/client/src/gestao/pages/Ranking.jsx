import React from "react";
import { Trophy } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import PageHeader from "../PageHeader";

export default function Ranking() {
  const { colors } = useTheme();
  return (
    <div className="flex flex-col h-full">
      <PageHeader icon={Trophy} title="Ranking" subtitle="Pontuação mensal por execução, pontualidade e consistência" />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Trophy size={32} className="mx-auto mb-3" style={{ color: colors.textSecondary }} />
          <div className="text-[13px] font-medium mb-1" style={{ color: colors.textPrimary }}>
            Em construção
          </div>
          <div className="text-[12px]" style={{ color: colors.textSecondary }}>
            Essa página ganha conteúdo na Etapa 10.
          </div>
        </div>
      </div>
    </div>
  );
}
