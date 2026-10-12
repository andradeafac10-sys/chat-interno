import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import LeftNav from "../components/LeftNav";
import AccountModal from "../components/AccountModal";
import { useTheme } from "../context/ThemeContext";

/**
 * Casca do Painel Gestão Nacional. O menu lateral próprio saiu daqui — agora
 * é a mesma coluna fixa (LeftNav) que aparece em qualquer tela do sistema,
 * pra não sumir quando a pessoa troca entre Chat e Gestão.
 */
export default function GestaoApp() {
  const [showAccount, setShowAccount] = useState(false);
  const { colors } = useTheme();
  return (
    <div className="w-screen h-screen flex overflow-hidden p-2 gap-2" style={{ background: colors.canvas }}>
      <LeftNav onOpenAccount={() => setShowAccount(true)} />
      <div className="flex-1 flex flex-col overflow-y-auto rounded-2xl" style={{ background: "var(--pagina-fundo)" }}>
        <Outlet />
      </div>
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
    </div>
  );
}
