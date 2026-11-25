const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const testPairs = [
  {
    plate: '浙A9T001',
    driver: {
      name: '路线测试司机1',
      phone: '13790000001',
      license: 'TEST-LICENSE-ROUTE-001',
    },
  },
  {
    plate: '浙A9T002',
    driver: {
      name: '路线测试司机2',
      phone: '13790000002',
      license: 'TEST-LICENSE-ROUTE-002',
    },
  },
];

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const created = [];

    for (const pair of testPairs) {
      let vehicle = await tx.vehicle.findUnique({
        where: { plate: pair.plate },
      });
      if (!vehicle) {
        vehicle = await tx.vehicle.create({
          data: {
            plate: pair.plate,
            capacityW: 500,
            capacityV: 20,
            status: 'IDLE',
          },
        });
        created.push(`车辆 ${vehicle.plate}`);
      }

      let driver = await tx.driver.findUnique({
        where: { license: pair.driver.license },
      });
      if (!driver) {
        driver = await tx.driver.create({
          data: pair.driver,
        });
        created.push(`司机 ${driver.name}`);
      }
    }

    const [idleVehicles, availableDrivers, pendingOrders] = await Promise.all([
      tx.vehicle.count({ where: { status: 'IDLE' } }),
      tx.driver.count({ where: { status: 'AVAILABLE' } }),
      tx.order.count({ where: { status: 'PENDING' } }),
    ]);

    return { created, idleVehicles, availableDrivers, pendingOrders };
  });

  if (result.created.length) {
    console.log(`已添加测试资源：${result.created.join('、')}。`);
  } else {
    console.log('测试车辆和司机已存在，本次未重复添加。');
  }
  console.log(
    `当前可用资源：空闲车辆 ${result.idleVehicles} 辆、可用司机 ${result.availableDrivers} 名、待处理订单 ${result.pendingOrders} 个。`,
  );
}

main()
  .catch((error) => {
    console.error('添加路线测试资源失败：', error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
