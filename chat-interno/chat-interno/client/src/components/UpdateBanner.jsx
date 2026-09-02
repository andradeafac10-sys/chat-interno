import React, { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../api";

/**
 * Fica de olho se saiu uma versão nova do site (o servidor muda de "versão"
 * toda vez que reinicia, ou seja, toda vez que sobe uma atualização).
 * Quando percebe, mostra um avisinho — sem precisar a pessoa dar F5 sozinha.
 */
export default function UpdateBanner() {
  const [temAtualizacao, setTemAtualizacao] = useState(false);
  const versaoInicialRef = useRef(null);

  useEffect(() => {
    let cancelado = false;

    const checar = async () => {
      try {
        const { data } = await api.get("/version");
        if (cancelado) return;
        if (versaoInicialRef.current === null) {
          versaoInicialRef.current = data.version;
        } else if (data.version !== versaoInicialRef.current) {
          setTemAtualizacao(true);
        }
      } catch {
        // se falhar em checar, não faz nada — tenta de novo no próximo intervalo
      }
    };

    checar();
    const intervalo = setInterval(checar, 30000); // confere a cada 30 segundos (5s era rápido demais e ajudava a estourar o limite de pedidos numa VPN)
    return () => { cancelado = true; clearInterval(intervalo); };
  }, []);

  if (!temAtualizacao) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex justify-center pt-3 pointer-events-none">
      <button
        onClick={() => window.location.reload()}
        className="pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg"
        style={{ background: "#2563EB" }}
      >
        <RefreshCw size={15} /> Tem uma atualização nova — clique pra atualizar
      </button>
    </div>
  );
}
