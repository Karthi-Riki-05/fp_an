/**
 * Admin Socket.io client.
 *
 * Connects to the backend without a specific tenantId (admin mode).
 * After connecting, the caller should emit `admin:join:all` to subscribe
 * to every tenant room simultaneously.
 *
 * Separate from the user-facing getSocket() singleton so admin and user
 * sockets do not interfere with each other.
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let _adminSocket: Socket | null = null;

export function getAdminSocket(): Socket {
  if (_adminSocket && _adminSocket.connected) return _adminSocket;

  if (_adminSocket) {
    _adminSocket.disconnect();
    _adminSocket = null;
  }

  _adminSocket = io(SOCKET_URL, {
    path: '/socket.io',
    withCredentials: true,   // sends access_token httpOnly cookie
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
  });

  return _adminSocket;
}

export function disconnectAdminSocket(): void {
  _adminSocket?.disconnect();
  _adminSocket = null;
}

export function getActiveAdminSocket(): Socket | null {
  return _adminSocket;
}
