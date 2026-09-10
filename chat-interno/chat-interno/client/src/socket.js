import { io } from "socket.io-client";
import { API_URL } from "./api";

let socket = null;

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(API_URL, { auth: { token } });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
