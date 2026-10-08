import { Module } from '@nestjs/common';
import { DispatchTasksController } from './dispatch-tasks.controller';
import { DispatchTasksService } from './dispatch-tasks.service';

@Module({
  controllers: [DispatchTasksController],
  providers: [DispatchTasksService],
  exports: [DispatchTasksService],
})
export class DispatchTasksModule {}
