/**
 * 一个参与路线计算的地点：仓库或配送点。
 * 坐标统一使用 WGS84 经纬度。
 */
export interface VrpPoint {
  id: string;
  lng: number; // 经度，范围 -180 到 180
  lat: number; // 纬度，范围 -90 到 90
}

/**
 * 距离矩阵结果。
 * pointIds 的顺序与矩阵的行、列顺序一致。
 */
export interface DistanceMatrixResult {
  pointIds: string[];
  distances: number[][];
  unit: 'm';
}