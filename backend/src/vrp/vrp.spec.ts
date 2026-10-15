import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { VrpController } from './vrp.controller';
import { VrpService } from './vrp.service';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewStore } from './preview-store';
import { ConfirmService } from './confirm.service';

describe('VRP HTTP contract', () => {
  let app: INestApplication;
  const prisma = {
    order: { findMany: jest.fn() },
    vehicle: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const body = {
    orderIds: [1],
    vehicleIds: [1],
    depot: { lng: 116.4, lat: 39.9 },
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [VrpController],
      providers: [
        VrpService,
        PreviewStore,
        ConfirmService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 1,
        customerId: 1,
        weight: 2,
        volume: 3,
        status: 'PENDING',
        customer: {
          lng: 116.41,
          lat: 39.9,
          timeWindowStart: 480,
          timeWindowEnd: 1080,
          serviceTime: 10,
        },
      },
    ]);
    prisma.vehicle.findMany.mockResolvedValue([
      { id: 1, capacityW: 10, capacityV: 10, status: 'IDLE' },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ i: 0, j: 1, distance: 853 }]);
  });
  afterAll(() => app.close());
  it('returns NSGA-II solutions with route metadata', async () => {
    const r = await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send({ ...body, algorithm: 'NSGA-II' })
      .expect(200);
    expect(r.body.algorithm).toBe('NSGA-II');
    expect(r.body.status).toBe('FOUND');
    expect(r.body.solutions[0].routes[0].stops[0].orderId).toBe(1);
    expect(r.body.previewOnly).toBe(true);
  });
  it('returns timed stops through HTTP and rejects zero speed', async () => {
    const r = await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send({ ...body, algorithm: 'VRPTW-GA' })
      .expect(200);
    expect(r.body.allTimeWindowsSatisfied).toBe(true);
    expect(r.body.routes[0].stops[0].arrivalTime).toBeCloseTo(481.706);
    await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send({ ...body, algorithm: 'VRPTW-GA', speedKmh: 0 })
      .expect(400);
  });
  it('rejects reversed stored windows', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 1,
        customerId: 1,
        status: 'PENDING',
        weight: 1,
        volume: 1,
        customer: {
          lng: 116.4,
          lat: 39.9,
          timeWindowStart: 600,
          timeWindowEnd: 500,
          serviceTime: 10,
        },
      },
    ]);
    await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send({ ...body, algorithm: 'VRPTW-GA' })
      .expect(400);
  });
  it('returns a complete preview with stop sequence', async () => {
    const r = await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send(body)
      .expect(200);
    expect(r.body.status).toBe('FOUND');
    expect(r.body.previewOnly).toBe(true);
    expect(r.body.totalDistance).toBe(1706);
    expect(r.body.routes[0].stops[0].orderId).toBe(1);
    expect(r.body.routes[0].totalCost).toBeNull();
  });
  it.each([
    { ...body, orderIds: [1, 1] },
    { ...body, depot: null },
    { ...body, depot: { lng: 181, lat: 0 } },
    { ...body, algorithm: 'UNKNOWN' },
    { ...body, orderIds: [] },
  ])('rejects invalid requests', async (invalid) => {
    await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send(invalid)
      .expect(400);
  });
  it('rejects unavailable orders', async () => {
    prisma.order.findMany.mockResolvedValue([{ id: 1, status: 'ASSIGNED' }]);
    await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send(body)
      .expect(400);
  });
  it('rejects missing records', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    await request(app.getHttpServer())
      .post('/vrp/optimize')
      .send(body)
      .expect(400);
  });
});
