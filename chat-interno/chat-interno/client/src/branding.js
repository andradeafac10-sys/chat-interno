import { useEffect, useState } from "react";
import { api } from "./api";
import { getSocket } from "./socket";

// Logo do sistema (subida pelo administrador principal). Busca uma vez,
// divide entre todos os componentes e atualiza sozinha quando trocar.
let cache = undefined; // undefined = ainda não buscou; null = sem logo
const ouvintes = new Set();

function carregar() {
  return api.get("/branding").then(({ data }) => {
    cache = data.logo || null;
    ouvintes.forEach((fn) => fn(cache));
  }).catch(() => { if (cache === undefined) cache = null; ouvintes.forEach((fn) => fn(cache)); });
}

export function recarregarLogo() { return carregar(); }

export function useLogo() {
  const [logo, setLogo] = useState(cache);
  useEffect(() => {
    ouvintes.add(setLogo);
    if (cache === undefined) carregar(); else setLogo(cache);
    const socket = getSocket();
    const onUpd = () => carregar();
    socket?.on("branding:updated", onUpd);
    return () => { ouvintes.delete(setLogo); socket?.off("branding:updated", onUpd); };
  }, []);
  return logo; // string (data URL) | null | undefined (carregando)
}
