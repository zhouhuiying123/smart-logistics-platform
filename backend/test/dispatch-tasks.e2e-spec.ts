import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('DispatchTasks 状态联动 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  it('VRP 确认生成 ASSIGNED 任务 -> STARTED -> COMPLETED 状态联动', async () => {
    const tag = Date.now();
    const customer = await request(app.getHttpServer())
      .post('/customers')
      .send({
        name: 'e2e-customer',
        phone: '13800138000',
        address: 'e2e-address',
        lng: 116.4,
        lat: 39.9,
        timeWindowStart: 480,
        timeWindowEnd: 600,
        serviceTime: 15,
      })
      .expect(201);
    const order = await request(app.getHttpServer())
      .post('/orders')
      .send({ customerId: customer.body.id, weight: 10, volume: 0.1 })
      .expect(201);
    const vehicle = await request(app.getHttpServer())
      .post('/vehicles')
      .send({ plate: 'E2E' + tag, capacityW: 1000, capacityV: 5 })
      .expect(201);
    const driver = await request(app.getHttpServer())
      .post('/drivers')
      .send({ name: 'e2e-driver', phone: '13800138001', license: 'E2E' + tag })
      .expect(201);

    const preview = await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send({
        algorithm: 'CVRP-GA',
        orderIds: [order.body.id],
        vehicleIds: [vehicle.body.id],
        depot: { lng: 116.4, lat: 39.9 },
      })
      .expect(200);
    expect(preview.body.status).toBe('FOUND');

    const confirmed = await request(app.getHttpServer())
      .post('/vrp/confirm')
      .send({
        previewId: preview.body.previewId,
        solutionId: preview.body.solutionId,
        assignments: [
          { vehicleId: vehicle.body.id, driverId: driver.body.id },
        ],
      })
      .expect(201);
    const task = confirmed.body.tasks[0];
    expect(task.status).toBe('ASSIGNED');

    const started = await request(app.getHttpServer())
      .patch(`/dispatch-tasks/${task.id}`)
      .send({ status: 'STARTED' })
      .expect(200);
    expect(started.body.status).toBe('STARTED');
    expect(started.body.driver.status).toBe('ON_DUTY');

    const done = await request(app.getHttpServer())
      .patch(`/dispatch-tasks/${task.id}`)
      .send({ status: 'COMPLETED', totalDist: 25.6, totalCost: 128.5 })
      .expect(200);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.driver.status).toBe('AVAILABLE');
    expect(done.body.vehicle.status).toBe('IDLE');

    await request(app.getHttpServer()).delete(`/dispatch-tasks/${task.id}`);
    await request(app.getHttpServer()).delete(`/orders/${order.body.id}`);
    await request(app.getHttpServer()).delete(`/vehicles/${vehicle.body.id}`);
    await request(app.getHttpServer()).delete(`/drivers/${driver.body.id}`);
    await request(app.getHttpServer()).delete(`/customers/${customer.body.id}`);
  });

  afterAll(async () => { await app.close(); });
});
