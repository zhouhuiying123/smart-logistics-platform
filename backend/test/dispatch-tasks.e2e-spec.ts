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

  it('CREATED -> ASSIGNED -> STARTED -> COMPLETED 状态联动', async () => {
    const created = await request(app.getHttpServer())
      .post('/dispatch-tasks')
      .send({ vehicleId: 1, driverId: 1 })
      .expect(201);
    expect(created.body.status).toBe('CREATED');
    const taskId = created.body.id;

    const assigned = await request(app.getHttpServer())
      .patch(`/dispatch-tasks/${taskId}`)
      .send({ status: 'ASSIGNED' })
      .expect(200);
    expect(assigned.body.status).toBe('ASSIGNED');
    expect(assigned.body.driver.status).toBe('ON_DUTY');

    await request(app.getHttpServer())
      .patch(`/dispatch-tasks/${taskId}`)
      .send({ status: 'STARTED', startTime: new Date().toISOString() })
      .expect(200);

    const done = await request(app.getHttpServer())
      .patch(`/dispatch-tasks/${taskId}`)
      .send({ status: 'COMPLETED', totalDist: 25.6, totalCost: 128.5, endTime: new Date().toISOString() })
      .expect(200);
    expect(done.body.status).toBe('COMPLETED');
    expect(done.body.driver.status).toBe('AVAILABLE');

    await request(app.getHttpServer()).delete(`/dispatch-tasks/${taskId}`);
  });

  afterAll(async () => { await app.close(); });
});
