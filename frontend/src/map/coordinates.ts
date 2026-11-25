const PI = Math.PI
const X_PI = PI * 3000 / 180
const A = 6378245
const EE = 0.006693421622965943

function outsideChina(lng: number, lat: number) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x: number, y: number) {
  let value = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  value += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  value += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3
  value += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3
  return value
}

function transformLng(x: number, y: number) {
  let value = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  value += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
  value += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3
  value += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3
  return value
}

function wgs84ToGcj02(lng: number, lat: number) {
  if (outsideChina(lng, lat)) return { lng, lat }
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = lat / 180 * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = dLat * 180 / ((A * (1 - EE)) / (magic * sqrtMagic) * PI)
  dLng = dLng * 180 / (A / sqrtMagic * Math.cos(radLat) * PI)
  return { lng: lng + dLng, lat: lat + dLat }
}

/** Convert API WGS84 coordinates into the BD09 coordinates used by Baidu Maps. */
export function toBaiduCoordinates(lng: number, lat: number) {
  const gcj = wgs84ToGcj02(lng, lat)
  const z = Math.sqrt(gcj.lng * gcj.lng + gcj.lat * gcj.lat) + 0.00002 * Math.sin(gcj.lat * X_PI)
  const theta = Math.atan2(gcj.lat, gcj.lng) + 0.000003 * Math.cos(gcj.lng * X_PI)
  return {
    lng: z * Math.cos(theta) + 0.0065,
    lat: z * Math.sin(theta) + 0.006,
  }
}
