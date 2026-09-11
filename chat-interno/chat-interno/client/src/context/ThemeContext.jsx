import React, { createContext, useContext, useEffect, useState } from "react";

// Paleta "Chat Nacional" — visual corporativo/SaaS moderno (Teams/Slack/Linear),
// com o azul usado só como cor de destaque/ação, não espalhado pela tela toda.
const THEMES = {
  dark: {
    sidebarBg: "#111113",
    sidebarHover: "#1C1C1F",
    sidebarActive: "#232326",
    chatBg: "#0A0A0B",
    headerBg: "#141416",
    headerBorder: "#232326",
    inputBarBg: "#141416",
    inputFieldBg: "#1C1C1F",
    textPrimary: "#F2F2F3",
    textSecondary: "#8A8A8E",
    ownBubbleBg: "#1E3A6B",
    ownBubbleText: "#EAF1FC",
    incomingBubbleBg: "#1C1C1F",
    incomingBubbleText: "#F2F2F3",
    border: "#232326",
    panelBg: "#141416",
    accent: "#2563EB",
    topbarBg: "#111113",
  },
  light: {
    sidebarBg: "#FFFFFF",
    sidebarHover: "#F7F9FC",
    sidebarActive: "#F0F5FF",
    chatBg: "#F7F9FC",
    headerBg: "#FFFFFF",
    headerBorder: "#E6ECF5",
    inputBarBg: "#FFFFFF",
    inputFieldBg: "#FFFFFF",
    textPrimary: "#1B2B4B",
    textSecondary: "#6E7C93",
    textMuted: "#98A2B3",
    ownBubbleBg: "#CFE3FB",
    ownBubbleText: "#0C447C",
    incomingBubbleBg: "#FFFFFF",
    incomingBubbleText: "#1B2B4B",
    border: "#E6ECF5",
    borderLight: "#EEF2F7",
    panelBg: "#FFFFFF",
    accent: "#2563EB",
    accentSoft: "#EAF1FF",
    accentSofter: "#F4F7FF",
    success: "#22C55E",
    danger: "#EF4444",
    warning: "#F59E0B",
    topbarBg: "#081328",
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("chatinterno_theme") || "light");

  useEffect(() => {
    localStorage.setItem("chatinterno_theme", theme);
    document.body.style.background = THEMES[theme].chatBg;
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
