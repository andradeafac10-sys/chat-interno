import React, { createContext, useContext, useEffect, useState } from "react";

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
  },
  light: {
    sidebarBg: "#FFFFFF",
    sidebarHover: "#F1F5FA",
    sidebarActive: "#E3ECF8",
    chatBg: "#EEF3FA",
    headerBg: "#FFFFFF",
    headerBorder: "#D3DEEC",
    inputBarBg: "#FFFFFF",
    inputFieldBg: "#EEF3FA",
    textPrimary: "#0A1628",
    textSecondary: "#5A7395",
    ownBubbleBg: "#D6E4FA",
    ownBubbleText: "#0A1628",
    incomingBubbleBg: "#FFFFFF",
    incomingBubbleText: "#0A1628",
    border: "#D3DEEC",
    panelBg: "#FFFFFF",
    accent: "#1E4B8F",
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("chatinterno_theme") || "dark");

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
