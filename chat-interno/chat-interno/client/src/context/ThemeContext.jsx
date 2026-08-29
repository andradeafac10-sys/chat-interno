import React, { createContext, useContext, useEffect, useState } from "react";

// Paleta "Chat Nacional" — visual corporativo/SaaS moderno (Teams/Slack/Linear),
// com o azul usado só como cor de destaque/ação, não espalhado pela tela toda.
const THEMES = {
  dark: {
    sidebarBg: "#0A1628",
    sidebarHover: "#12233D",
    sidebarActive: "#1B3A63",
    chatBg: "#061020",
    headerBg: "#12233D",
    headerBorder: "#1E3555",
    inputBarBg: "#12233D",
    inputFieldBg: "#1B2F4D",
    textPrimary: "#E8EEF7",
    textSecondary: "#8CA3C4",
    ownBubbleBg: "#1E4B8F",
    ownBubbleText: "#F2F6FC",
    incomingBubbleBg: "#12233D",
    incomingBubbleText: "#E8EEF7",
    border: "#1E3555",
    panelBg: "#12233D",
    accent: "#2E6FD9",
    topbarBg: "#072B5A",
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
    ownBubbleBg: "#F4F7FF",
    ownBubbleText: "#1B2B4B",
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
    topbarBg: "#072B5A",
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("chatinterno_theme") || "light");

  useEffect(() => {
    localStorage.setItem("chatinterno_theme", theme);
    document.body.style.background = THEMES[theme].chatBg;
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: THEMES[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
