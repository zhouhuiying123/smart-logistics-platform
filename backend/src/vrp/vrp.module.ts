import { TrackingModule } from '../tracking/tracking.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VrpController } from './vrp.controller';
import { VrpService } from './vrp.service';
import { PreviewStore } from './preview-store';
import { ConfirmService } from './confirm.service';

@Module({
  imports: [PrismaModule, TrackingModule],
  controllers: [VrpController],
  providers: [VrpService, PreviewStore, ConfirmService],
})
export class VrpModule {}
