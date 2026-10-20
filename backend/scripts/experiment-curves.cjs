const fs=require('fs');require('ts-node/register');
const {solveCvrp}=require('../src/vrp/cvrp');
const source=JSON.parse(fs.readFileSync('demo/algorithm-experiment/results.json','utf8'));
const histories=[];
for(const algorithm of ['CVRP-GA','VRPTW-GA']){
 const item=source.raw.find(x=>x.scenario==='20-tight'&&x.seed===42&&x.algorithm===algorithm);
 const input=algorithm==='CVRP-GA'?{...item.input,timing:undefined}:item.input;
 const history=[];solveCvrp(input,42,(generation,best)=>history.push({generation,score:best.objectiveScore??best.totalDistance,missing:best.unassignedOrderIds.length}));
 histories.push({algorithm,history});
}
const front=source.raw.find(x=>x.scenario==='20-tight'&&x.seed===42&&x.algorithm==='NSGA-II').result.solutions;
fs.writeFileSync('demo/algorithm-experiment/curves.json',JSON.stringify({histories,front:front.map(s=>({distance:s.totalDistance,vehicles:s.usedVehicleCount,late:s.totalLateMinutes}))},null,2));
console.log('Saved actual generation history and final Pareto solutions');
