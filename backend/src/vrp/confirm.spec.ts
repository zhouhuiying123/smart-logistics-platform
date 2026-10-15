import { PreviewStore } from './preview-store';
import { ConfirmService } from './confirm.service';
describe('preview confirmation', () => {
  const orders = [
    {
      id: 1,
      status: 'PENDING',
      customerId: 1,
      weight: 1,
      volume: 1,
      customer: {
        lng: 0,
        lat: 0,
        timeWindowStart: 0,
        timeWindowEnd: 1440,
        serviceTime: 0,
      },
    },
  ];
  const fleet = [{ id: 1, status: 'IDLE', capacityW: 10, capacityV: 10 }];
  const solutions = [
    {
      solutionId: 'solution-1',
      routes: [
        {
          vehicleId: 1,
          orderIds: [1],
          totalDistance: 0,
          stops: [{ orderId: 1, seq: 1, lng: 0, lat: 0 }],
        },
      ],
    },
  ];
  it('rejects expired, busy and consumed previews', () => {
    const store = new PreviewStore();
    const saved = store.save(solutions, orders, fleet);
    const entry = store.acquire(saved.previewId);
    expect(() => store.acquire(saved.previewId)).toThrow();
    entry.busy = false;
    entry.consumed = true;
    expect(() => store.acquire(saved.previewId)).toThrow();
    entry.consumed = false;
    entry.expiresAt = 0;
    expect(() => store.acquire(saved.previewId)).toThrow();
  });
  it('rejects incorrect binding and unlocks the preview for retry', async () => {
    const store = new PreviewStore();
    const saved = store.save(solutions, orders, fleet);
    const db = { $transaction: jest.fn() };
    const service = new ConfirmService(db as any, store);
    await expect(
      service.confirm({
        ...saved,
        solutionId: 'solution-1',
        assignments: [{ vehicleId: 2, driverId: 1 }],
      }),
    ).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(store.acquire(saved.previewId).busy).toBe(true);
  });
  it('checks stale capacity before any writes', async () => {
    const store = new PreviewStore();
    const saved = store.save(solutions, orders, fleet);
    const tx = {
      order: {
        findMany: jest.fn().mockResolvedValue(orders),
        updateMany: jest.fn(),
      },
      vehicle: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ...fleet[0], capacityW: 0.5 }]),
      },
    };
    const service = new ConfirmService(
      { $transaction: (fn: any) => fn(tx) } as any,
      store,
    );
    await expect(
      service.confirm({
        ...saved,
        solutionId: 'solution-1',
        assignments: [{ vehicleId: 1, driverId: 1 }],
      }),
    ).rejects.toThrow('变化');
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});
