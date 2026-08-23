import React from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Balõezinhos no canto inferior direito avisando quem entrou/saiu do chat.
 * Somem sozinhos depois de alguns segundos.
 */
export default function PresenceToasts({ toasts }) {
  const { colors } = useTheme();
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.key}
          className="flex items-center gap-2.5 rounded-full pl-3 pr-4 py-2 shadow-lg border toast-slide-in"
          style={{ background: colors.panelBg, borderColor: colors.border }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: t.online ? "#22C55E" : "#94A3B8" }}
          />
          <span className="text-[13px] whitespace-nowrap" style={{ color: colors.textPrimary }}>
            <strong className="font-semibold">{t.userName}</strong>{" "}
            <span style={{ color: colors.textSecondary }}>{t.online ? "online" : "offline"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
