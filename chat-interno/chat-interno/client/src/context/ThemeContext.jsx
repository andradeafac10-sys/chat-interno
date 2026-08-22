import React, { createContext, useContext, useEffect, useState } from "react";

const THEMES = {
  dark: {
    sidebarBg: "#111B21",
    sidebarHover: "#202C33",
    sidebarActive: "#2A3942",
    chatBg: "#0B141A",
    headerBg: "#202C33",
    headerBorder: "#2A3942",
    inputBarBg: "#202C33",
    inputFieldBg: "#2A3942",
    textPrimary: "#E9EDEF",
    textSecondary: "#8696A0",
    ownBubbleBg: "#005C4B",
    ownBubbleText: "#E9EDEF",
    incomingBubbleBg: "#202C33",
    incomingBubbleText: "#E9EDEF",
    border: "#2A3942",
    panelBg: "#202C33",
  },
  light: {
    sidebarBg: "#FFFFFF",
    sidebarHover: "#F5F6F6",
    sidebarActive: "#F0F2F5",
    chatBg: "#EFEAE2",
    headerBg: "#FFFFFF",
    headerBorder: "#D1D7DB",
    inputBarBg: "#FFFFFF",
    inputFieldBg: "#F0F2F5",
    textPrimary: "#111B21",
    textSecondary: "#667781",
    ownBubbleBg: "#D9FDD3",
    ownBubbleText: "#111B21",
    incomingBubbleBg: "#FFFFFF",
    incomingBubbleText: "#111B21",
    border: "#D1D7DB",
    panelBg: "#FFFFFF",
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
