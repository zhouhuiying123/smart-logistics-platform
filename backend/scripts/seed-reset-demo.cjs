require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL 未配置，拒绝清理数据库。');

const target = new URL(databaseUrl);
const databaseName = decodeURIComponent(target.pathname.slice(1));
if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || databaseName !== 'logistics') {
  throw new Error(
    `安全保护：重置脚本只允许连接 localhost 上名为 logistics 的数据库（当前目标：${target.hostname}/${databaseName}）。`,
  );
}

const prisma = new PrismaClient();

const customers = [
  { name: '西湖区湖滨客户', phone: '13900001001', address: '杭州市上城区平海路', lng: 120.163, lat: 30.259, timeWindowStart: 480, timeWindowEnd: 1020, serviceTime: 12 },
  { name: '拱墅区武林客户', phone: '13900001002', address: '杭州市拱墅区武林路', lng: 120.166, lat: 30.276, timeWindowStart: 540, timeWindowEnd: 1020, serviceTime: 15 },
  { name: '西湖区文三客户', phone: '13900001003', address: '杭州市西湖区文三路', lng: 120.126, lat: 30.279, timeWindowStart: 600, timeWindowEnd: 1080, serviceTime: 10 },
  { name: '滨江区江南客户', phone: '13900001004', address: '杭州市滨江区江南大道', lng: 120.206, lat: 30.208, timeWindowStart: 480, timeWindowEnd: 900, serviceTime: 20 },
  { name: '余杭区仓前客户', phone: '13900001005', address: '杭州市余杭区仓前街道', lng: 120.009, lat: 30.279, timeWindowStart: 600, timeWindowEnd: 1080, serviceTime: 12 },
  { name: '萧山区市心客户', phone: '13900001006', address: '杭州市萧山区市心北路', lng: 120.264, lat: 30.187, timeWindowStart: 480, timeWindowEnd: 960, serviceTime: 15 },
  { name: '钱塘区下沙客户', phone: '13900001007', address: '杭州市钱塘区金沙大道', lng: 120.342, lat: 30.307, timeWindowStart: 660, timeWindowEnd: 1080, serviceTime: 10 },
  { name: '上城区钱江客户', phone: '13900001008', address: '杭州市上城区钱江路', lng: 120.197, lat: 30.236, timeWindowStart: 480, timeWindowEnd: 1020, serviceTime: 18 },
  { name: '西湖区转塘客户', phone: '13900001009', address: '杭州市西湖区转塘街道', lng: 120.108, lat: 30.176, timeWindowStart: 540, timeWindowEnd: 1080, serviceTime: 10 },
  { name: '临平区南苑客户', phone: '13900001010', address: '杭州市临平区南苑街道', lng: 120.299, lat: 30.421, timeWindowStart: 600, timeWindowEnd: 1080, serviceTime: 15 },
  { name: '滨江区长河客户', phone: '13900001011', address: '杭州市滨江区长河街道', lng: 120.183, lat: 30.195, timeWindowStart: 480, timeWindowEnd: 960, serviceTime: 12 },
];

const vehicles = [
  { plate: '浙A·演示01', capacityW: 300, capacityV: 5, status: 'IDLE' },
  { plate: '浙A·演示02', capacityW: 300, capacityV: 5, status: 'IDLE' },
  { plate: '浙A·演示03', capacityW: 500, capacityV: 8, status: 'IDLE' },
  { plate: '浙A·演示04', capacityW: 300, capacityV: 5, status: 'IDLE' },
  { plate: '浙A·演示05', capacityW: 300, capacityV: 5, status: 'ON_DUTY' },
  { plate: '浙A·演示06', capacityW: 500, capacityV: 8, status: 'ON_DUTY' },
];

const drivers = [
  { name: '演示司机张师傅', phone: '13800002001', license: 'DEMO-HZ-DRIVER-001', status: 'AVAILABLE' },
  { name: '演示司机李师傅', phone: '13800002002', license: 'DEMO-HZ-DRIVER-002', status: 'AVAILABLE' },
  { name: '演示司机王师傅', phone: '13800002003', license: 'DEMO-HZ-DRIVER-003', status: 'AVAILABLE' },
  { name: '演示司机陈师傅', phone: '13800002004', license: 'DEMO-HZ-DRIVER-004', status: 'AVAILABLE' },
  { name: '在途司机赵师傅', phone: '13800002005', license: 'DEMO-HZ-DRIVER-005', status: 'ON_DUTY' },
  { name: '已分配司机周师傅', phone: '13800002006', license: 'DEMO-HZ-DRIVER-006', status: 'ON_DUTY' },
];

const orderSpecs = [
  { status: 'DELIVERED', weight: 32, volume: 0.45, priority: 1 },
  { status: 'ASSIGNED', weight: 28, volume: 0.4, priority: 2 },
  { status: 'IN_TRANSIT', weight: 36, volume: 0.55, priority: 1 },
  { status: 'CANCELLED', weight: 20, volume: 0.3, priority: 0 },
  { status: 'FAILED', weight: 24, volume: 0.35, priority: 1 },
  { status: 'PENDING', weight: 22, volume: 0.3, priority: 2 },
  { status: 'PENDING', weight: 35, volume: 0.55, priority: 1 },
  { status: 'PENDING', weight: 18, volume: 0.25, priority: 0 },
  { status: 'PENDING', weight: 40, volume: 0.65, priority: 2 },
  { status: 'PENDING', weight: 26, volume: 0.4, priority: 1 },
  { status: 'PENDING', weight: 30, volume: 0.5, priority: 0 },
];

async function main() {
  const counts = await prisma.$transaction(async (tx) => {
    await tx.dispatchStop.deleteMany();
    await tx.dispatchTask.deleteMany();
    await tx.order.deleteMany();
    await tx.customer.deleteMany();
    await tx.vehicle.deleteMany();
    await tx.driver.deleteMany();

    const createdCustomers = [];
    for (const customer of customers) {
      createdCustomers.push(await tx.customer.create({ data: customer }));
    }
    const createdOrders = [];
    for (const [index, spec] of orderSpecs.entries()) {
      createdOrders.push(await tx.order.create({
        data: { ...spec, customerId: createdCustomers[index].id },
      }));
    }
    const createdVehicles = [];
    for (const vehicle of vehicles) {
      createdVehicles.push(await tx.vehicle.create({ data: vehicle }));
    }
    const createdDrivers = [];
    for (const driver of drivers) {
      createdDrivers.push(await tx.driver.create({ data: driver }));
    }

    const now = new Date();
    const history = [
      {
        vehicleIndex: 3, driverIndex: 3, status: 'COMPLETED', orderIndex: 0,
        totalDist: 8200, startTime: new Date(now.getTime() - 86400000), endTime: new Date(now.getTime() - 82800000), arrived: true,
      },
      {
        vehicleIndex: 4, driverIndex: 4, status: 'STARTED', orderIndex: 2,
        totalDist: 5100, startTime: new Date(now.getTime() - 1800000), endTime: null, arrived: false,
      },
      {
        vehicleIndex: 5, driverIndex: 5, status: 'ASSIGNED', orderIndex: 1,
        totalDist: 6700, startTime: null, endTime: null, arrived: false,
      },
      {
        vehicleIndex: 2, driverIndex: 2, status: 'CANCELLED', orderIndex: 3,
        totalDist: 4600, startTime: null, endTime: new Date(now.getTime() - 3600000), arrived: false,
      },
    ];
    for (const item of history) {
      await tx.dispatchTask.create({
        data: {
          vehicleId: createdVehicles[item.vehicleIndex].id,
          driverId: createdDrivers[item.driverIndex].id,
          status: item.status,
          totalDist: item.totalDist,
          totalCost: item.totalDist * 0.003,
          startTime: item.startTime,
          endTime: item.endTime,
          stops: {
            create: [{
              orderId: createdOrders[item.orderIndex].id,
              seq: 1,
              lng: createdCustomers[item.orderIndex].lng,
              lat: createdCustomers[item.orderIndex].lat,
              arrived: item.arrived,
            }],
          },
        },
      });
    }

    const [customerCount, orderCount, vehicleCounts, driverCounts, taskCounts] = await Promise.all([
      tx.customer.count(),
      tx.order.count(),
      tx.vehicle.groupBy({ by: ['status'], _count: { _all: true } }),
      tx.driver.groupBy({ by: ['status'], _count: { _all: true } }),
      tx.dispatchTask.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { customerCount, orderCount, vehicleCounts, driverCounts, taskCounts };
  });

  console.log('演示数据库已在事务中清理并重新导入。');
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error('重置并导入演示数据失败：', error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
