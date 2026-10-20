// Run with node scripts/demo-cvrp.cjs while the local backend is running.
// Adds labelled demo records only; existing records are never cleared or reset.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = 'http://localhost:3000';
async function api(route, body) {
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${route}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function main() {
  const customers = await api('/customers');
  const orders = await api('/orders');
  const vehicles = await api('/vehicles');
  const selectedOrders = [], selectedVehicles = [];
  const coordinates = [[116.41,39.9],[116.42,39.91],[116.41,39.92],[116.39,39.9],[116.38,39.91],[116.39,39.92]];
  for (let i=0;i<coordinates.length;i++) {
    const name = `CVRP-DEMO-20261012-${i+1}`;
    let customer = customers.find(c=>c.name===name && c.phone==='DEMO-NO-PHONE');
    if (!customer) customer = await api('/customers', {name,phone:'DEMO-NO-PHONE',address:'演示地点（虚构客户）',lng:coordinates[i][0],lat:coordinates[i][1],timeWindowStart:480,timeWindowEnd:1080,serviceTime:10});
    let order = orders.find(o=>o.customerId===customer.id);
    if (!order) order = await api('/orders', {customerId:customer.id,weight:100,volume:1,priority:0});
    if (order.status!=='PENDING') throw new Error(`演示订单 ${order.id} 已被使用；请勿重置业务状态。`);
    selectedOrders.push(order);
  }
  for (let i=1;i<=2;i++) {
    const plate = `DEMO-CVRP-${i}`;
    let vehicle = vehicles.find(v=>v.plate===plate);
    if (!vehicle) vehicle = await api('/vehicles',{plate,capacityW:300,capacityV:3});
    if (vehicle.status!=='IDLE') throw new Error(`演示车辆 ${vehicle.id} 当前非空闲。`);
    selectedVehicles.push(vehicle);
  }
  const payload={algorithm:'CVRP-GA',orderIds:selectedOrders.map(o=>o.id),vehicleIds:selectedVehicles.map(v=>v.id),depot:{lng:116.4,lat:39.9},returnToDepot:true,seed:42};
  const start=performance.now();
  const result=await api('/vrp/optimize',payload);
  const elapsedMs=Math.round(performance.now()-start);
  assert.equal(result.status,'FOUND');
  assert.deepEqual(result.routes.flatMap(r=>r.orderIds).sort((a,b)=>a-b),[...payload.orderIds].sort((a,b)=>a-b));
  for(const r of result.routes) {
    const vehicle=selectedVehicles.find(v=>v.id===r.vehicleId);
    assert.ok(vehicle);
    assert.ok(r.totalWeight<=vehicle.capacityW && r.totalVolume<=vehicle.capacityV);
  }
  const afterOrders=await api('/orders'), afterVehicles=await api('/vehicles');
  assert.ok(selectedOrders.every(o=>afterOrders.find(a=>a.id===o.id).status==='PENDING'));
  assert.ok(selectedVehicles.every(v=>afterVehicles.find(a=>a.id===v.id).status==='IDLE'));
  const directory=path.join(__dirname,'../demo'); fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'cvrp-request.json'),JSON.stringify(payload,null,2)+'\n');
  fs.writeFileSync(path.join(directory,'cvrp-result.json'),JSON.stringify({testedAt:new Date().toISOString(),elapsedMs,...result},null,2)+'\n');
  console.log(JSON.stringify({elapsedMs,request:payload,result},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
