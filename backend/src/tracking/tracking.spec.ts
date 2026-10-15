import { TrackingGateway } from './tracking.gateway';
import { DispatchTasksService } from '../dispatch-tasks/dispatch-tasks.service';
describe('tracking commit boundary', () => {
 it('emits only minimal task metadata', () => {
  const gateway = new TrackingGateway(); const emit = jest.fn(); gateway.server = { emit } as any;
  gateway.publish({ id: 3, status: 'STARTED', vehicleId: 2, driverId: 4 });
  expect(emit).toHaveBeenCalledWith('task.updated', expect.objectContaining({taskId:3,status:'STARTED'}));
 });
 it('does not emit a rolled back operation', async () => {
  const publish = jest.fn();
  const service = new DispatchTasksService({$transaction: jest.fn().mockRejectedValue(new Error('rollback'))} as any, {publish} as any);
  await expect(service.update(1,{status:'STARTED'})).rejects.toThrow('rollback');expect(publish).not.toHaveBeenCalled();
 });
 it('emits after transaction success', async () => {
  const task = {id:1,status:'STARTED',vehicleId:1,driverId:1}; const publish=jest.fn();
  const service = new DispatchTasksService({$transaction: jest.fn().mockResolvedValue(task)} as any,{publish} as any);
  expect(await service.update(1,{status:'STARTED'})).toEqual(task);expect(publish).toHaveBeenCalledWith(task);
 });
});
