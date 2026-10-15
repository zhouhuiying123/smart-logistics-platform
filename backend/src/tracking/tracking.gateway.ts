import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
@WebSocketGateway({ namespace: '/tracking', cors: { origin: true } })
export class TrackingGateway {
  @WebSocketServer() server!: Server;
  publish(task: { id: number; status: string; vehicleId: number; driverId: number }) {
    this.server?.emit('task.updated', { taskId: task.id, status: task.status, vehicleId: task.vehicleId, driverId: task.driverId, emittedAt: new Date().toISOString() });
  }
}
