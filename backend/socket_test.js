const io = require('socket.io-client');

const JWT = process.env.JWT;
const SOCKET_URL = 'http://localhost:4000';

console.log('Connecting to', SOCKET_URL, 'with JWT length:', JWT.length);

const socket = io(SOCKET_URL, {
  path: '/socket.io',
  extraHeaders: {
    Cookie: `access_token=${JWT}`
  },
  transports: ['websocket', 'polling'],
  reconnection: false,
  timeout: 10000,
});

const TIMEOUT = setTimeout(() => {
  console.log('TIMEOUT: No response in 10s');
  process.exit(1);
}, 10000);

socket.on('connect', () => {
  console.log('CONNECTED, socket.id:', socket.id);
  console.log('Emitting client:resync...');
  socket.emit('client:resync');
});

socket.on('resync:snapshot', (data) => {
  console.log('RECEIVED resync:snapshot:', JSON.stringify(data).slice(0, 400));
  clearTimeout(TIMEOUT);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.log('CONNECT_ERROR:', err.message);
  clearTimeout(TIMEOUT);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('DISCONNECTED:', reason);
});
