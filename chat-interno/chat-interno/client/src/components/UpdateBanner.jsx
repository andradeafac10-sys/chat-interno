import { useEffect, useRef } from "react";
import { api } from "../api";

/**
 * Atualização automática: a cada 5 minutos confere se saiu versão nova do
 * sistema (o servidor muda de "versão" toda vez que reinicia). Se saiu, dá o
 * F5 sozinho — sem aviso na tela. Só não recarrega se a pessoa estiver com
 * texto digitado num campo (pra ninguém perder mensagem); tenta de novo em
 * 1 minuto.
 */
const CINCO_MIN = 5 * 60 * 1000;

function digitandoAlgo() {
  const el = document.activeElement;
  if (!el) return false;
  const campo = el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable;
  return campo && ((el.value && String(el.value).trim().length > 0) || (el.isContentEditable && el.textContent.trim().length > 0));
}

export default function UpdateBanner() {
  const versaoInicialRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    let timer = null;

    const agendar = (ms) => {
      timer = setTimeout(checar, ms);
    };

    const checar = async () => {
      let proximo = CINCO_MIN;
      try {
        const { data } = await api.get("/version");
        if (cancelado) return;
        if (versaoInicialRef.current === null) {
          versaoInicialRef.current = data.version;
        } else if (data.version !== versaoInicialRef.current) {
          if (digitandoAlgo()) {
            proximo = 60 * 1000;
          } else {
            window.location.reload();
            return;
          }
        }
      } catch {
        // falhou em checar: tenta de novo no próximo ciclo
      }
      if (!cancelado) agendar(proximo);
    };

    checar();
    return () => { cancelado = true; clearTimeout(timer); };
  }, []);

  return null;
}
