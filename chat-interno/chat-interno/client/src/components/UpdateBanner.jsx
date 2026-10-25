import { useEffect, useRef } from "react";
import { api } from "../api";

/**
 * Atualização automática: a cada 5 minutos confere se saiu versão nova do
 * sistema (o servidor muda de "versão" toda vez que reinicia). Se saiu, dá o
 * F5 sozinho — sem aviso na tela. Só não recarrega se a pessoa estiver com
 * texto digitado num campo (pra ninguém perder mensagem); tenta de novo em
 * 1 minuto.
 */
const DOIS_MIN = 2 * 60 * 1000;
const CINCO_MIN = 5 * 60 * 1000;

// Dia de hoje em Brasília (AAAA-MM-DD) — o painel recarrega do zero a cada dia novo
const diaHoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const DIA_DO_CARREGAMENTO = diaHoje();
const VERSAO_DO_CODIGO = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null;

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
      let proximo = DOIS_MIN;
      try {
        // 1) Saiu versão nova do painel (compara o código carregado com o version.json publicado)
        let precisaRecarregar = diaHoje() !== DIA_DO_CARREGAMENTO; // 2) virou o dia
        if (VERSAO_DO_CODIGO) {
          try {
            const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
            if (r.ok) {
              const v = await r.json();
              if (v.version && v.version !== VERSAO_DO_CODIGO) precisaRecarregar = true;
            }
          } catch {}
        }
        if (precisaRecarregar) {
          if (digitandoAlgo()) proximo = 60 * 1000;
          else { window.location.reload(); return; }
        }
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
    // Ao voltar pra aba/janela, confere na hora
    const aoVoltar = () => { if (document.visibilityState === "visible" && !cancelado) { clearTimeout(timer); checar(); } };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => { cancelado = true; clearTimeout(timer); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("focus", aoVoltar); };
  }, []);

  return null;
}
