import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DriversModule } from './drivers/drivers.module';
import { DispatchTasksModule } from './dispatch-tasks/dispatch-tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CustomersModule,
    OrdersModule,
    VehiclesModule,
    DriversModule,
    DispatchTasksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}