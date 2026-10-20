const assert = require('node:assert/strict');
const fs = require('node:fs');
async function api(id, body, expected = 200) {
  const r = await fetch(`http://localhost:3000/dispatch-tasks/${id}`, {
    method: body ? 'PATCH' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const d = await r.json();
  assert.equal(r.status, expected, JSON.stringify(d));
  return d;
}
(async () => {
  const before = await api(1);
  assert.equal(before.status, 'ASSIGNED');
  await api(1, { status: 'COMPLETED' }, 400);
  assert.deepEqual(await api(1), before);
  const start = await api(1, { status: 'STARTED' });
  assert.ok(start.startTime);
  assert.ok(start.stops.every((s) => s.order.status === 'IN_TRANSIT'));
  assert.equal(start.vehicle.status, 'ON_DUTY');
  const repeated = await api(1, { status: 'STARTED' });
  assert.equal(repeated.startTime, start.startTime);
  const done = await api(1, { status: 'COMPLETED' });
  assert.ok(done.endTime);
  assert.ok(
    done.stops.every((s) => s.arrived && s.order.status === 'DELIVERED'),
  );
  assert.equal(done.vehicle.status, 'IDLE');
  assert.equal(done.driver.status, 'AVAILABLE');
  await api(1, { status: 'STARTED' }, 400);
  assert.deepEqual(await api(1), done);
  await api(2, { status: 'STARTED' });
  const cancelled = await api(2, { status: 'CANCELLED' });
  assert.ok(
    cancelled.stops.every((s) => !s.arrived && s.order.status === 'PENDING'),
  );
  assert.equal(cancelled.vehicle.status, 'IDLE');
  assert.equal(cancelled.driver.status, 'AVAILABLE');
  fs.writeFileSync(
    'demo/lifecycle-result.json',
    JSON.stringify({ done, cancelled }, null, 2),
  );
  console.log(
    'PASS: invalid transition unchanged; start; idempotent repeat; complete; terminal rejection; cancellation restores orders and releases resources',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
