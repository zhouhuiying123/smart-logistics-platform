import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DistanceMatrixResult, VrpPoint } from './vrp.types';

interface DistanceRow {
  i: number;
  j: number;
  distance: number;
}

/**
 * 使用 PostGIS 计算球面距离矩阵，单位为米。
 * 行、列顺序与输入 points 的顺序一致。
 */
export async function buildDistanceMatrix(
  prisma: PrismaService,
  points: VrpPoint[],
): Promise<DistanceMatrixResult> {
  // 先限制规模，避免一次生成过大的矩阵。
  if (!Array.isArray(points) || points.length > 500) {
    throw new BadRequestException('points 必须是数组，且最多包含 500 个点');
  }

  const ids = new Set<string>();

  for (const point of points) {
    if (
      !point ||
      typeof point.id !== 'string' ||
      point.id.trim().length === 0
    ) {
      throw new BadRequestException('每个点必须有非空字符串 id');
    }

    if (ids.has(point.id)) {
      throw new BadRequestException(`点编号重复：${point.id}`);
    }
    ids.add(point.id);

    if (
      !Number.isFinite(point.lng) ||
      !Number.isFinite(point.lat) ||
      point.lng < -180 ||
      point.lng > 180 ||
      point.lat < -90 ||
      point.lat > 90
    ) {
      throw new BadRequestException(`点 ${point.id} 的经纬度不合法`);
    }
  }

  const distances: number[][] = Array.from(
    { length: points.length },
    () => Array<number>(points.length).fill(0),
  );

  if (points.length <= 1) {
    return {
      pointIds: points.map((point) => point.id),
      distances,
      unit: 'm',
    };
  }

  // 将坐标作为查询参数传入，不直接拼接到 SQL 中。
  const coordinates = JSON.stringify(
    points.map((point, index) => ({
      index,
      lng: point.lng,
      lat: point.lat,
    })),
  );

  const rows = await prisma.$queryRaw<DistanceRow[]>`
    WITH input_points AS (
      SELECT
        (item->>'index')::integer AS idx,
        ST_SetSRID(
          ST_MakePoint(
            (item->>'lng')::double precision,
            (item->>'lat')::double precision
          ),
          4326
        ) AS geom
      FROM jsonb_array_elements(
        ${coordinates}::jsonb
      ) AS entries(item)
    )
    SELECT
      a.idx AS i,
      b.idx AS j,
      ST_DistanceSphere(a.geom, b.geom) AS distance
    FROM input_points a
    CROSS JOIN input_points b
    WHERE a.idx < b.idx
  `;

  // 球面距离是对称的：A 到 B 与 B 到 A 相等。
  for (const row of rows) {
    distances[row.i][row.j] = row.distance;
    distances[row.j][row.i] = row.distance;
  }

  return {
    pointIds: points.map((point) => point.id),
    distances,
    unit: 'm',
  };
}