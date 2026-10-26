# 智慧物流配送与路径优化平台后端

本目录包含 NestJS REST API、Prisma 数据访问、客户/订单/车辆/司机/调度任务模块、CVRP/VRPTW/NSGA-II 优化及 Socket.IO 任务通知。

首次运行、PostGIS 迁移、演示数据和检查命令见本目录 [`README.md`](README.md) 与仓库根目录 [`README.md`](../README.md)。`pnpm.cmd run seed:reset-demo` 会清空本机 `localhost/logistics` 的业务数据并重建完整演示案例；运行前确认目标数据库无须保留现有数据。
