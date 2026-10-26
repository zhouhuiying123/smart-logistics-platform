import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('系统状态')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: '健康检查（验证服务是否存活）' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
