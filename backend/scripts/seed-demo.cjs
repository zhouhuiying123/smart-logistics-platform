const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const customers = [
  { name: '演示客户一', phone: '13900000001', address: '杭州市上城区湖滨路', lng: 120.163, lat: 30.259, timeWindowStart: 480, timeWindowEnd: 1080, serviceTime: 10 },
  { name: '演示客户二', phone: '13900000002', address: '杭州市拱墅区武林路', lng: 120.166, lat: 30.276, timeWindowStart: 480, timeWindowEnd: 1080, serviceTime: 10 },
  { name: '演示客户三', phone: '13900000003', address: '杭州市西湖区文三路', lng: 120.126, lat: 30.279, timeWindowStart: 480, timeWindowEnd: 1080, serviceTime: 10 },
  { name: '演示客户四', phone: '13900000004', address: '杭州市滨江区江南大道', lng: 120.206, lat: 30.208, timeWindowStart: 480, timeWindowEnd: 1080, serviceTime: 10 },
  { name: '演示客户五', phone: '13900000005', address: '杭州市余杭区仓前街道', lng: 120.009, lat: 30.279, timeWindowStart: 480, timeWindowEnd: 1080, serviceTime: 10 },
];

async function main() {
  const existing = await prisma.$transaction([
    prisma.customer.count(),
    prisma.order.count(),
    prisma.vehicle.count(),
    prisma.driver.count(),
    prisma.dispatchTask.count(),
  ]);
  if (existing.some((count) => count > 0)) {
    console.log('数据库已有业务数据，演示初始化已跳过，未修改任何记录。');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const createdCustomers = [];
    for (const customer of customers) {
      createdCustomers.push(await tx.customer.create({ data: customer }));
    }
    for (const [index, customer] of createdCustomers.entries()) {
      await tx.order.create({ data: { customerId: customer.id, weight: 20 + index * 5, volume: 0.1 + index * 0.02, priority: index % 3 } });
    }
    for (let index = 1; index <= 3; index++) {
      await tx.vehicle.create({ data: { plate: `演示车${index}`, capacityW: 200, capacityV: 5 } });
      await tx.driver.create({ data: { name: `演示司机${index}`, phone: `1380000000${index}`, license: `DEMO-LICENSE-${index}` } });
    }
  });
  console.log('演示数据已创建：5 个客户、5 个待配送订单、3 辆空闲车辆和 3 名可用司机。');
}

main()
  .catch((error) => {
    console.error('演示数据初始化失败：', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
