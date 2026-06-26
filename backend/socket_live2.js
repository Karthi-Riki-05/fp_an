const io = require('socket.io-client');
const JWT = process.env.JWT;
const socket = io('http://localhost:4000', {
  path: '/socket.io',
  extraHeaders: { Cookie: `access_token=${JWT}` },
  transports: ['websocket', 'polling'],
  reconnection: false,
  timeout: 15000,
});

const TIMEOUT = setTimeout(() => {
  console.log('TIMEOUT: no event received');
  process.exit(1);
}, 20000);

socket.on('connect', () => {
  console.log('CONNECTED socket.id:', socket.id);
});

['machine:status:changed','machine:online','machine:offline','machine:stop:started','machine:stop:ended'].forEach(ev => {
  socket.on(ev, (data) => {
    console.log('RECEIVED', ev + ':', JSON.stringify(data));
    clearTimeout(TIMEOUT);
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (err) => {
  console.log('CONNECT_ERROR:', err.message);
  clearTimeout(TIMEOUT);
  process.exit(1);
});
