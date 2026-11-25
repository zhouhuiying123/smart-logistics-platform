import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(__dirname, '..', 'admin-ui'), { prefix: '/admin' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: true, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('智慧物流配送与路径优化平台 API')
    .setDescription(
      [
        '后端提供 **基础数据管理**、**调度任务流转** 与 **VRP 路径优化** 三大能力。',
        '',
        '| 模块 | 接口前缀 | 说明 |',
        '| --- | --- | --- |',
        '| 客户 / 订单 / 车辆 / 司机 | /customers · /orders · /vehicles · /drivers | 四类基础资源的增删改查 |',
        '| 调度任务 | /dispatch-tasks | 任务创建与状态流转，自动联动车辆、司机、订单状态 |',
        '| 路径优化 | /vrp | GA 系列算法求解配送路线：optimize 生成预览 → confirm 生成任务 |',
        '',
        '### 如何测试接口（三步）',
        '',
        '1. 展开目标接口，点击右侧 **Try it out** 按钮',
        '2. 填写参数，或直接使用示例请求体',
        '3. 点击 **Execute** 执行，下方查看响应 JSON 与耗时',
        '',
        '> 💡 页面顶部有搜索框，输入「订单」「vrp」「调度」可快速筛选接口。',
        '',
        '### 统一约定',
        '',
        '- 错误响应格式：`{ statusCode, message, error }`',
        '- 订单状态机：`PENDING → ASSIGNED → IN_TRANSIT → DELIVERED / FAILED / CANCELLED`',
        '- 调度任务状态机：`CREATED → ASSIGNED → STARTED → COMPLETED / CANCELLED`',
        '- 订单与任务状态由调度任务流转自动更新，请勿直接修改活动任务的关联资源',
      ].join('\n'),
    )
    .addTag('系统状态', '服务健康检查：探活与部署验证')
    .addTag('客户管理', '配送点信息：坐标、时间窗、服务时长 —— VRP 优化的需求来源')
    .addTag('订单管理', '配送任务单：关联客户与货物重量/体积，状态随调度任务自动流转')
    .addTag('车辆管理', '配送运力：载重/容积上限 —— VRP 容量约束的来源')
    .addTag('司机管理', '驾驶员信息：调度时与车辆一对一绑定')
    .addTag('调度任务', '一次配送的执行单元：状态流转自动联动车辆/司机/订单')
    .addTag('路径优化', '平台核心算法：optimize 生成路线预览 → confirm 确认并生成调度任务')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: '智慧物流平台 · API 控制台',
    customCss: `
      .swagger-ui .topbar { background: linear-gradient(90deg, #142e4d, #1b4d7a); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
      .swagger-ui .topbar-wrapper .link img { display: none; }
      .swagger-ui .topbar-wrapper .link::after { content: '智慧物流平台 · API 控制台'; color: #fff; font-size: 15px; font-weight: 600; letter-spacing: 0.5px; }
      .swagger-ui .info .title { color: #142e4d; font-size: 28px; }
      .swagger-ui .info .title small.version-stamp { background: #1b4d7a; border-radius: 999px; }
      .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info td { font-size: 14px; line-height: 1.8; color: #24384c; }
      .swagger-ui .opblock-tag { font-size: 17px; color: #142e4d; font-weight: 700; }
      .swagger-ui .opblock { border-radius: 10px; border: none; box-shadow: 0 1px 2px rgba(20,46,77,0.05), 0 3px 12px rgba(20,46,77,0.07); }
      .swagger-ui .opblock .opblock-summary { padding: 6px 12px; }
      .swagger-ui .opblock .opblock-summary-description { font-size: 14px; }
      .swagger-ui .scheme-container { box-shadow: none; border-bottom: 1px solid #e3eaf1; }
      .swagger-ui .filter .operation-filter-input { border: 1px solid #e3eaf1; border-radius: 8px; padding: 10px 14px; font-size: 14px; }
    `,
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
