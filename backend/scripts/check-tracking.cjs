// Isolated Socket.IO transport test: no database and no existing task changes.
require('ts-node/register');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { TrackingModule } = require('../src/tracking/tracking.module');
const { TrackingGateway } = require('../src/tracking/tracking.gateway');

(async () => {
  const app = await NestFactory.create(TrackingModule, { logger: false });
  let socket;
  try {
    await app.listen(0, '127.0.0.1');
    const port = app.getHttpServer().address().port;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket.IO event timeout')), 10000);
      const finish = error => { clearTimeout(timer); error ? reject(error) : resolve(); };
      socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
      socket.onerror = () => finish(new Error('WebSocket connection failed'));
      socket.onmessage = message => {
        try {
          const packet = String(message.data);
          if (packet.startsWith('0')) socket.send('40/tracking,');
          else if (packet === '2') socket.send('3');
          else if (packet.startsWith('40/tracking,')) {
            app.get(TrackingGateway).publish({ id: 123, status: 'STARTED', vehicleId: 4, driverId: 5 });
          } else if (packet.startsWith('42/tracking,')) {
            const [event, payload] = JSON.parse(packet.slice('42/tracking,'.length));
            assert.equal(event, 'task.updated');
            assert.equal(payload.taskId, 123);
            assert.equal(payload.status, 'STARTED');
            assert.equal(payload.vehicleId, 4);
            assert.equal(payload.driverId, 5);
            assert.ok(Number.isFinite(Date.parse(payload.emittedAt)));
            finish();
          }
        } catch (error) { finish(error); }
      };
    });
    console.log('PASS: real Socket.IO namespace handshake and task.updated delivery (isolated, no database changes)');
  } finally {
    socket?.close();
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
