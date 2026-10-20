import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Drivers (e2e)', () => {
  let app: INestApplication;
  const license = 'TEST' + Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  it('POST /drivers 创建司机 -> 201, 默认 status=AVAILABLE', async () => {
    const res = await request(app.getHttpServer())
      .post('/drivers')
      .send({ name: 'test-driver', phone: '13800138000', license })
      .expect(201);
    expect(res.body.status).toBe('AVAILABLE');
  });

  it('POST /drivers 重复驾驶证号 -> 409', () => {
    return request(app.getHttpServer())
      .post('/drivers')
      .send({ name: 'dup', phone: '13800138001', license })
      .expect(409);
  });

  it('GET /drivers 返回数组', async () => {
    const res = await request(app.getHttpServer()).get('/drivers').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  afterAll(async () => {
    const list = await request(app.getHttpServer()).get('/drivers');
    const created = list.body.find((d: any) => d.license === license);
    if (created) await request(app.getHttpServer()).delete(`/drivers/${created.id}`);
    await app.close();
  });
});
