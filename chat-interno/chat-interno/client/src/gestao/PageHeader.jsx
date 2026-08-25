import React from "react";
import { useTheme } from "../context/ThemeContext";

/** Cabeçalho padrão de cada página do painel: título + descrição curta. */
export default function PageHeader({ icon: Icon, title, subtitle }) {
  const { colors } = useTheme();
  return (
    <div className="h-16 flex items-center gap-2.5 px-6 border-b shrink-0" style={{ background: colors.headerBg, borderColor: colors.headerBorder }}>
      {Icon && <Icon size={18} className="text-[#2E6FD9] shrink-0" />}
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold truncate" style={{ color: colors.textPrimary }}>{title}</h1>
        {subtitle && <p className="text-[11px] truncate" style={{ color: colors.textSecondary }}>{subtitle}</p>}
      </div>
    </div>
  );
}
