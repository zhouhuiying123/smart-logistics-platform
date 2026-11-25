# 智慧物流配送与路径优化平台

课程综合项目：物流工程系统 + CVRP-GA / VRPTW-GA / NSGA-II 路线优化。

## 本地启动

需要 Node.js、pnpm、Docker Desktop 和百度地图浏览器端 AK。首次启动前复制 `backend/.env.example` 为 `backend/.env`，按本机环境填写数据库连接；复制 `frontend/.env.example` 为 `frontend/.env.local` 并填写 AK。地图密钥只需允许本机开发域名，不要提交到 Git。

在项目根目录启动数据库，再在后端终端启动 API：

```powershell
docker compose up -d
cd backend
pnpm.cmd install
pnpm.cmd exec prisma generate
pnpm.cmd exec prisma migrate deploy
pnpm.cmd run start:dev
```

另开终端启动前端：

```powershell
cd frontend
pnpm.cmd install
pnpm.cmd run dev
```

如数据库为空，可另开后端终端执行 `pnpm.cmd run seed:demo` 创建一套演示记录；该脚本检测到任何业务表已有数据时会跳过，不覆盖现有数据。已有数据库缺少可调度资源时，可执行 `pnpm.cmd run seed:route-test`，幂等添加两辆空闲测试车和两名可用测试司机，不修改现有记录。若要重建完整演示环境，在 backend 目录执行 `pnpm.cmd run seed:reset-demo`；该命令会清空本机 `localhost/logistics` 中的所有业务数据，再导入完整测试案例，脚本拒绝连接其他数据库。打开 Vite 输出的地址（默认 `http://localhost:5173`）。后端 Swagger 在 `http://localhost:3000/api/docs`。前后端和数据库都要保持运行；打开 Swagger 只会看到接口文档，不会打开地图页面。
