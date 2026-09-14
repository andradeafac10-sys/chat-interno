import React, { createContext, useContext, useEffect, useState } from "react";

// Paleta "Chat Nacional" — visual corporativo/SaaS moderno (Teams/Slack/Linear),
// com o azul usado só como cor de destaque/ação, não espalhado pela tela toda.
const THEMES = {
  dark: {
    sidebarBg: "#0D1117",
    sidebarHover: "#1C2128",
    sidebarActive: "#21262D",
    sidebarText: "#E6EDF3",
    sidebarTextSecondary: "#9BA7B4",
    sidebarBorder: "#21262D",
    topbarText: "#E6EDF3",
    topbarTextSecondary: "#9BA7B4",
    topbarBorder: "#21262D",
    chatBg: "#0D1117",
    headerBg: "#161B22",
    headerBorder: "#21262D",
    inputBarBg: "#161B22",
    inputFieldBg: "#1C2128",
    textPrimary: "#E6EDF3",
    textSecondary: "#9BA7B4",
    ownBubbleBg: "#1F3A5F",
    ownBubbleText: "#E6EDF3",
    incomingBubbleBg: "#1C2128",
    incomingBubbleText: "#E6EDF3",
    border: "#21262D",
    panelBg: "#161B22",
    accent: "#58A6FF",
    topbarBg: "#0D1117",
  },
  light: {
    sidebarBg: "#0D1117",
    sidebarHover: "#1C2128",
    sidebarActive: "#21262D",
    sidebarText: "#E6EDF3",
    sidebarTextSecondary: "#9BA7B4",
    sidebarBorder: "#21262D",
    topbarBg: "#0D1117",
    topbarText: "#E6EDF3",
    topbarTextSecondary: "#9BA7B4",
    topbarBorder: "#21262D",
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
