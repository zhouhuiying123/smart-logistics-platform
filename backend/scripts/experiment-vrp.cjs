// Read-only, synthetic solver experiment; no database or HTTP writes.
require('ts-node/register');
const {solveCvrp}=require('../src/vrp/cvrp');
const {solveNsga2}=require('../src/vrp/nsga2');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const out=path.join(__dirname,'../demo/algorithm-experiment');fs.mkdirSync(out,{recursive:true});
function scenario(n,tight){
 const points=[[116.4,39.9],...Array.from({length:n},(_,i)=>[116.4+Math.cos(i*2.39996)*(0.01+(i%7)*0.004),39.9+Math.sin(i*2.39996)*(0.01+(i%7)*0.004)])];
 const rad=x=>x*Math.PI/180;
 const distances=points.map(a=>points.map(b=>{const h=Math.sin(rad(b[1]-a[1])/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(rad(b[0]-a[0])/2)**2;return 6371008.8*2*Math.asin(Math.sqrt(Math.min(1,h)));}));
 return {orders:Array.from({length:n},(_,i)=>({orderId:i+1,pointIndex:i+1,weight:100,volume:1,timeWindowStart:480+(tight?(i%3)*10:0),timeWindowEnd:tight?495+(i%3)*10:1080,serviceTime:10})),vehicles:Array.from({length:Math.ceil(n/5)},(_,i)=>({vehicleId:i+1,capacityW:500,capacityV:5})),distances,returnToDepot:true,timing:{departureTime:480,speedKmh:30,penaltyPerMinute:1000}};
}
function evaluate(input,routes){
 const seen=[];let distance=0,late=0;
 for(const route of routes){let w=0,v=0,last=0,time=480,rd=0;const vehicle=input.vehicles.find(v=>v.vehicleId===route.vehicleId);assert.ok(vehicle);
 for(const id of route.orderIds){const o=input.orders.find(o=>o.orderId===id);assert.ok(o);seen.push(id);w+=o.weight;v+=o.volume;rd+=input.distances[last][o.pointIndex];time+=input.distances[last][o.pointIndex]/500;time=Math.max(time,o.timeWindowStart);late+=Math.max(0,time-o.timeWindowEnd);time+=o.serviceTime;last=o.pointIndex;}
 rd+=input.distances[last][0];distance+=rd;assert.ok(w<=vehicle.capacityW && v<=vehicle.capacityV);assert.ok(Math.abs(rd-route.totalDistance)<1e-6);
 }
 assert.deepEqual(seen.sort((a,b)=>a-b),input.orders.map(o=>o.orderId));assert.equal(new Set(routes.map(r=>r.vehicleId)).size,routes.length);
 return {distance,vehicles:routes.length,late};
}
const rows=[],raw=[];const scenarios=[['6-wide',6,false],['20-tight',20,true],['50-tight',50,true]];
for(const [name,n,tight] of scenarios)for(const seed of [7,42,123])for(const algorithm of ['CVRP-GA','VRPTW-GA','NSGA-II']){
 const input=scenario(n,tight);const start=performance.now();const result=algorithm==='NSGA-II'?solveNsga2(input,seed):solveCvrp(algorithm==='CVRP-GA'?{...input,timing:undefined}:input,seed);const ms=performance.now()-start;assert.equal(result.status,'FOUND');
 const solutions=algorithm==='NSGA-II'?result.solutions:[result];const metrics=solutions.map(s=>evaluate(input,s.routes));
 if(algorithm!=='CVRP-GA')solutions.forEach((s,i)=>assert.ok(Math.abs(s.totalLateMinutes-metrics[i].late)<1e-6));
 // Keep every NSGA-II solution; representative is explicitly shortest distance, then vehicles, then lateness.
 const selected=[...metrics].sort((a,b)=>a.distance-b.distance||a.vehicles-b.vehicles||a.late-b.late)[0];
 rows.push({scenario:name,seed,algorithm,...selected,solutions:solutions.length,ms});raw.push({scenario:name,seed,algorithm,input,result});
 console.log(`${name} seed=${seed} ${algorithm}: PASS (${ms.toFixed(1)} ms, ${solutions.length} solution(s))`);
}
const meta={createdAt:new Date().toISOString(),node:process.version,cpu:os.cpus()[0]?.model,platform:process.platform,seeds:[7,42,123]};
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({meta,rows,raw},null,2));
fs.writeFileSync(path.join(out,'summary.csv'),'scenario,seed,algorithm,distance_m,vehicles,late_minutes,solutions,solver_ms\n'+rows.map(r=>[r.scenario,r.seed,r.algorithm,r.distance,r.vehicles,r.late,r.solutions,r.ms].join(',')).join('\n'));
const table=rows.map(r=>`| ${r.scenario} | ${r.seed} | ${r.algorithm} | ${r.distance.toFixed(2)} | ${r.vehicles} | ${r.late.toFixed(2)} | ${r.solutions} | ${r.ms.toFixed(1)} |`).join('\n');
const report=`# 算法对比实验（自动生成）\n\n生成时间：${meta.createdAt}\n\n## 实验范围\n\n3 个合成场景 × 3 个随机种子 × 3 种算法，共 27 次。6-wide 为宽时间窗，20-tight、50-tight 为较紧时间窗。所有场景使用同一生成规则和相同容量、速度、服务时长。原始输入及所有候选方案保存在 results.json。\n\n距离使用 Haversine 球面公式（地球半径 6371008.8 米），不是道路距离。本实验直接调用现有求解器，不读写数据库，也不生成调度任务。\n\nCVRP 不优化时间窗，但本报告按相同速度和时间窗重新计算其迟到，便于比较。NSGA-II 保留全部方案，表格只展示距离最短的方案（平局依次比较车辆数和迟到），不能据此认定多目标算法整体优劣。\n\n耗时只计求解器运行，不含数据库、PostGIS、HTTP、启动和文件保存；未单独预热，顺序执行，3 个种子不足以证明统计显著性。50 点小于 10 秒只能说明本机这些样本的求解器耗时，不代表端到端性能验收。\n\n## 校验\n\n27 次均检查完整且不重复覆盖订单、重量和体积容量、车辆不重复、路线距离；时间窗算法输出的迟到与独立重算一致。FOUND 不保证全局最优或无迟到。\n\n环境：${meta.node} / ${meta.platform} / ${meta.cpu}\n\n| 场景 | 种子 | 算法 | 距离(米) | 车辆数 | 迟到(分钟) | 方案数 | 求解耗时(ms) |\n|---|---|---|---:|---:|---:|---:|---:|\n${table}\n\n## 用户验证\n\n在 backend 文件夹运行 pnpm.cmd run experiment:vrp，最后应显示 PASS: 27 runs。重复运行相同种子的路线结果应稳定，耗时会变化。此命令不会改变已有订单或任务状态。\n`;
fs.writeFileSync(path.join(out,'REPORT.md'),report);
console.log('PASS: 27 runs. Report: '+path.join(out,'REPORT.md'));
