// Confirms the labelled CVRP demo data. Intentionally leaves the resulting tasks assigned.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const base='http://localhost:3000';
async function api(route,body,expected=200){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;}
async function main(){
 const request=JSON.parse(fs.readFileSync(path.join(__dirname,'../demo/cvrp-request.json'),'utf8'));
 const preview=await api('/vrp/optimize',request);
 const alternative=await api('/vrp/optimize',request);
 const existing=await api('/drivers');const assignments=[];
 for(const route of preview.routes){
  const license=`DEMO-CONFIRM-${route.vehicleId}`;
  let driver=existing.find(d=>d.license===license);
  if(!driver)driver=await api('/drivers',{name:`演示司机${route.vehicleId}`,phone:'13800000000',license},201);
  assert.equal(driver.status,'AVAILABLE');assignments.push({vehicleId:route.vehicleId,driverId:driver.id});
 }
 const body={previewId:preview.previewId,solutionId:'solution-1',assignments};
 const ordersBefore=await api('/orders'),vehiclesBefore=await api('/vehicles'),tasksBefore=await api('/dispatch-tasks');
 await api('/vrp/confirm',{...body,assignments:assignments.map((a,i)=>({...a,driverId:2000000000+i}))},409);
 assert.deepEqual(await api('/orders'),ordersBefore);assert.deepEqual(await api('/vehicles'),vehiclesBefore);assert.deepEqual(await api('/dispatch-tasks'),tasksBefore);
 // Two independently generated previews compete for the same resources.
 const responses=await Promise.all([body,{...body,previewId:alternative.previewId}].map(b=>fetch(base+'/vrp/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)})));
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
 const winner=responses.findIndex(r=>r.status===201);const result=await responses[winner].json();
 await api('/vrp/confirm',winner===0?body:{...body,previewId:alternative.previewId},409);
 const tasks=await api('/dispatch-tasks');assert.equal(tasks.length,tasksBefore.length+preview.routes.length);
 const orders=await api('/orders'),vehicles=await api('/vehicles'),drivers=await api('/drivers');
 for(const task of result.tasks){assert.equal(task.status,'ASSIGNED');assert.equal(vehicles.find(v=>v.id===task.vehicleId).status,'ON_DUTY');assert.equal(drivers.find(d=>d.id===task.driverId).status,'ON_DUTY');for(const stop of task.stops)assert.equal(orders.find(o=>o.id===stop.orderId).status,'ASSIGNED');}
 assert.deepEqual(result.tasks.flatMap(t=>t.stops.map(s=>s.orderId)).sort((a,b)=>a-b),[...request.orderIds].sort((a,b)=>a-b));
 fs.writeFileSync(path.join(__dirname,'../demo/confirm-result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({taskIds:result.tasks.map(t=>t.id),assignments,concurrentResponses:[201,409],repeatedResponse:409,invalidDriverNoChanges:true},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
