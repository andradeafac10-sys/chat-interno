import React, { createContext, useContext, useEffect, useState } from "react";

// Paleta "Painel Nacional" — visual corporativo/SaaS moderno (Teams/Slack/Linear),
// com o azul usado só como cor de destaque/ação, não espalhado pela tela toda.
const THEMES = {
  dark: {
    canvas: "#0D0817",
    sidebarBg: "#231452",
    sidebarHover: "#2E1D66",
    sidebarActive: "#6D28D9",
    sidebarText: "#F5F3FF",
    sidebarTextSecondary: "#C4B5FD",
    sidebarBorder: "#3B2A78",
    topbarText: "#EDE9FE",
    topbarTextSecondary: "#B4A5E0",
    topbarBorder: "#2A1D52",
    chatBg: "#120C22",
    headerBg: "#17102B",
    headerBorder: "#2A1D52",
    inputBarBg: "#17102B",
    inputFieldBg: "#241A40",
    textPrimary: "#FFFFFF",
    textSecondary: "#DDD5F7",
    textMuted: "#B4A5E0",
    ownBubbleBg: "#4C1D95",
    ownBubbleText: "#F5F3FF",
    incomingBubbleBg: "#241A40",
    incomingBubbleText: "#EDE9FE",
    border: "#2A1D52",
    borderLight: "#241A40",
    panelBg: "#17102B",
    selectedBg: "#2A1D52",
    badgeBg: "#FFFFFF",
    badgeText: "#6D28D9",
    accent: "#A78BFA",
    topbarBg: "#0D0817",
  },
  light: {
    canvas: "#ECE8F6",
    sidebarBg: "#2E1065",
    sidebarHover: "#3B1A7E",
    sidebarActive: "#5B21B6",
    sidebarText: "#F5F3FF",
    sidebarTextSecondary: "#DDD6FE",
    sidebarBorder: "#4C1D95",
    topbarBg: "#ECE8F6",
    topbarText: "#2A1B4D",
    topbarTextSecondary: "#6B5E8C",
    topbarBorder: "#DDD6FE",
    chatBg: "#F6F4FB",
    headerBg: "#FFFFFF",
    headerBorder: "#ECE8F6",
    inputBarBg: "#FFFFFF",
    inputFieldBg: "#F3F0FA",
    textPrimary: "#2A1B4D",
    textSecondary: "#6B5E8C",
    textMuted: "#9A8FB8",
    ownBubbleBg: "#DDD6FE",
    ownBubbleText: "#4C1D95",
    incomingBubbleBg: "#FFFFFF",
    incomingBubbleText: "#2A1B4D",
    border: "#ECE8F6",
    borderLight: "#F3F0FA",
    panelBg: "#FFFFFF",
    selectedBg: "#EDE9FE",
    badgeBg: "#6D28D9",
    badgeText: "#FFFFFF",
    accent: "#7C3AED",
    accentSoft: "#EDE9FE",
    accentSofter: "#F5F3FF",
    success: "#22C55E",
    danger: "#EF4444",
    warning: "#F59E0B",
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("chatinterno_theme") || "light");

  useEffect(() => {
    localStorage.setItem("chatinterno_theme", theme);
    document.body.style.background = THEMES[theme].canvas;
    // Classe no <body> pra qualquer tela do sistema (Gestão, Feedbacks, Trilha,
    // Usuários, Monitoria...) responder ao tema, não só o Chat em si — as
    // variáveis CSS que essas telas usam (--pagina-fundo etc.) mudam sozinhas
    // via index.css quando essa classe está presente.
    document.body.classList.toggle("tema-escuro", theme === "dark");
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: THEMES[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
