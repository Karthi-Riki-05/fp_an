const io = require('socket.io-client');

const JWT = process.env.JWT;
const SOCKET_URL = 'http://localhost:4000';

const socket = io(SOCKET_URL, {
  path: '/socket.io',
  extraHeaders: { Cookie: `access_token=${JWT}` },
  transports: ['websocket', 'polling'],
  reconnection: false,
  timeout: 15000,
});

const TIMEOUT = setTimeout(() => {
  console.log('TIMEOUT waiting for machine:status:changed event');
  process.exit(1);
}, 20000);

socket.on('connect', () => {
  console.log('CONNECTED socket.id:', socket.id);
  console.log('Listening for machine:status:changed... (publish MQTT now)');
});

socket.on('machine:status:changed', (data) => {
  console.log('RECEIVED machine:status:changed:', JSON.stringify(data));
  clearTimeout(TIMEOUT);
  socket.disconnect();
  process.exit(0);
});

socket.on('machine:stop:started', (data) => {
  console.log('RECEIVED machine:stop:started:', JSON.stringify(data));
  clearTimeout(TIMEOUT);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.log('CONNECT_ERROR:', err.message);
  clearTimeout(TIMEOUT);
  process.exit(1);
});
