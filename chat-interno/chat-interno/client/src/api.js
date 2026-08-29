import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// timeout de 15s: sem isso, se o servidor nunca responder (ex: engasgo no banco),
// a requisição fica pendurada pra sempre e qualquer botão de "Enviando..." trava
// pra sempre também, só saindo com F5.
export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function fileUrl(path) {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}
