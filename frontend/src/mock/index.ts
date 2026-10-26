// Mock 数据 —— 当 VITE_USE_MOCK=true 或 API 请求失败时自动生效
// 经纬度围绕杭州市区，地图能真实渲染路线

export const mockOrders = [
  { id: 1, customerId: 1, customer: { id: 1, name: '杭州大厦', phone: '13800001111', address: '杭州市拱墅区延安路1号', lng: 120.1689, lat: 30.2663 }, weight: 120, volume: 2.5, status: 'PENDING', priority: 2 },
  { id: 2, customerId: 2, customer: { id: 2, name: '西湖银泰', phone: '13800002222', address: '杭州市上城区延安路98号', lng: 120.1694, lat: 30.2484 }, weight: 80, volume: 1.8, status: 'PENDING', priority: 2 },
  { id: 3, customerId: 3, customer: { id: 3, name: '钱江新城万象城', phone: '13800003333', address: '杭州市江干区富春路701号', lng: 120.2166, lat: 30.2472 }, weight: 200, volume: 3.2, status: 'PENDING', priority: 1 },
  { id: 4, customerId: 4, customer: { id: 4, name: '运河上街', phone: '13800004444', address: '杭州市拱墅区台州路2号', lng: 120.1312, lat: 30.3236 }, weight: 60, volume: 1.2, status: 'ASSIGNED', priority: 2 },
  { id: 5, customerId: 5, customer: { id: 5, name: '滨江宝龙', phone: '13800005555', address: '杭州市滨江区江南大道2288号', lng: 120.2122, lat: 30.2089 }, weight: 150, volume: 2.8, status: 'IN_TRANSIT', priority: 1 },
  { id: 6, customerId: 6, customer: { id: 6, name: '临平银泰', phone: '13800006666', address: '杭州市余杭区世纪大道1号', lng: 120.2911, lat: 30.3904 }, weight: 90, volume: 1.5, status: 'DELIVERED', priority: 3 },
  { id: 7, customerId: 7, customer: { id: 7, name: '萧山恒隆', phone: '13800007777', address: '杭州市萧山区山阴路688号', lng: 120.2758, lat: 30.1815 }, weight: 110, volume: 2.0, status: 'PENDING', priority: 2 },
  { id: 8, customerId: 8, customer: { id: 8, name: '西湖文化广场', phone: '13800008888', address: '杭州市下城区中山北路581号', lng: 120.1721, lat: 30.2832 }, weight: 70, volume: 1.3, status: 'PENDING', priority: 3 },
]

export const mockVehicles = [
  { id: 1, plate: '浙A·12345', capacityW: 500, capacityV: 8, status: 'IDLE' },
  { id: 2, plate: '浙A·67890', capacityW: 800, capacityV: 12, status: 'IDLE' },
  { id: 3, plate: '浙A·11111', capacityW: 600, capacityV: 10, status: 'ON_DUTY' },
  { id: 4, plate: '浙A·22222', capacityW: 400, capacityV: 6, status: 'MAINTENANCE' },
]

export const mockDrivers = [
  { id: 1, name: '张师傅', phone: '13900000001', license: 'A1', status: 'AVAILABLE' },
  { id: 2, name: '李师傅', phone: '13900000002', license: 'A2', status: 'AVAILABLE' },
  { id: 3, name: '王师傅', phone: '13900000003', license: 'B1', status: 'ON_DUTY' },
  { id: 4, name: '赵师傅', phone: '13900000004', license: 'A1', status: 'OFF' },
]

export const mockTasks = [
  {
    id: 1, vehicleId: 3, driverId: 3, status: 'STARTED', startTime: '2026-10-22T08:00:00Z',
    totalDist: 15200, totalCost: 85.5,
    vehicle: { id: 3, plate: '浙A·11111', status: 'ON_DUTY' },
    driver: { id: 3, name: '王师傅', status: 'ON_DUTY' },
    stops: [
      { id: 1, taskId: 1, orderId: 5, seq: 1, lng: 120.2122, lat: 30.2089, arrived: false },
    ],
  },
  {
    id: 2, vehicleId: 1, driverId: 1, status: 'ASSIGNED',
    totalDist: 0, totalCost: 0,
    vehicle: { id: 1, plate: '浙A·12345', status: 'IDLE' },
    driver: { id: 1, name: '张师傅', status: 'AVAILABLE' },
    stops: [],
  },
  {
    id: 3, vehicleId: 2, driverId: 2, status: 'COMPLETED',
    startTime: '2026-10-21T09:00:00Z', endTime: '2026-10-21T14:30:00Z',
    totalDist: 28500, totalCost: 160.2,
    vehicle: { id: 2, plate: '浙A·67890', status: 'IDLE' },
    driver: { id: 2, name: '李师傅', status: 'AVAILABLE' },
    stops: [],
  },
]

// 仓库/工厂模拟
function makeRepo<T extends { id: number }>(items: T[]) {
  return {
    findAll: () => Promise.resolve([...items]),
    findOne: (id: number) => {
      const it = items.find((i) => i.id === id)
      return it ? Promise.resolve({ ...it }) : Promise.reject({ response: { data: { message: 'not found' } } })
    },
    create: (data: Partial<T>) => {
      const id = (items.at(-1)?.id ?? 0) + 1
      const created = { ...(data as any), id }
      items.push(created)
      return Promise.resolve(created)
    },
    update: (id: number, data: Partial<T>) => {
      const idx = items.findIndex((i) => i.id === id)
      if (idx >= 0) { items[idx] = { ...items[idx], ...data }; return Promise.resolve(items[idx]) }
      return Promise.reject({ response: { data: { message: 'not found' } } })
    },
    remove: (id: number) => {
      const idx = items.findIndex((i) => i.id === id)
      if (idx >= 0) { items.splice(idx, 1); return Promise.resolve() }
      return Promise.reject({ response: { data: { message: 'not found' } } })
    },
  }
}

export const ordersRepo = makeRepo(mockOrders)
export const vehiclesRepo = makeRepo(mockVehicles)
export const driversRepo = makeRepo(mockDrivers)
export const tasksRepo = makeRepo(mockTasks)

// VRP 模拟：用简单的最近邻贪心生成路线
export function mockOptimize(data: { orderIds: number[]; vehicleIds: number[]; algorithm?: string }) {
  const orders = mockOrders.filter((o) => data.orderIds.includes(o.id) && o.customer)
  if (orders.length === 0) {
    return Promise.reject({ response: { data: { message: '没有选中有效订单' } } })
  }
  const vehicles = data.vehicleIds.map((id) => mockVehicles.find((v) => v.id === id)).filter(Boolean) as typeof mockVehicles
  const previewId = 'preview-' + Math.random().toString(36).slice(2, 10)
  const solutions: any[] = []

  // 为每个算法生成一个方案
  const algorithms = data.algorithm ? [data.algorithm] : ['CVRP-GA', 'VRPTW-GA', 'NSGA-II']
  for (const algo of algorithms) {
    const palette = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12']
    const vehicleRoutes: any[] = []
    // 贪心分配：按车辆容量均分订单
    const n = vehicles.length || 1
    const chunk = Math.ceil(orders.length / n)
    let totalDist = 0
    vehicles.forEach((v, i) => {
      const slice = orders.slice(i * chunk, (i + 1) * chunk)
      const stops = slice.map((o, j) => ({
        orderId: o.id, seq: j + 1,
        lng: o.customer!.lng, lat: o.customer!.lat,
      }))
      let dist = 0
      for (let k = 1; k < stops.length; k++) {
        const dx = (stops[k].lng - stops[k - 1].lng) * 111000
        const dy = (stops[k].lat - stops[k - 1].lat) * 111000
        dist += Math.sqrt(dx * dx + dy * dy)
      }
      totalDist += dist
      vehicleRoutes.push({ vehicleId: v.id, distance: Math.round(dist), stops })
    })
    solutions.push({
      id: `${algo}-1`,
      algorithm: algo,
      totalDistance: Math.round(totalDist),
      totalCost: null,
      feasible: true,
      vehicles: vehicleRoutes,
    })
  }
  return Promise.resolve({ previewId, solutions })
}

export function mockConfirm(data: { previewId: string; solutionId: string; assignments: Array<{ vehicleId: number; driverId: number }> }) {
  const taskIds: number[] = []
  for (const a of data.assignments) {
    const taskId = (mockTasks.at(-1)?.id ?? 3) + taskIds.length + 1
    taskIds.push(taskId)
    mockTasks.push({
      id: taskId, vehicleId: a.vehicleId, driverId: a.driverId,
      status: 'ASSIGNED', totalDist: 0, totalCost: 0,
      vehicle: mockVehicles.find((v) => v.id === a.vehicleId) as any,
      driver: mockDrivers.find((d) => d.id === a.driverId) as any,
      stops: [],
    })
  }
  return Promise.resolve({ message: 'ok', taskIds })
}

// 距离矩阵模拟
export function mockDistanceMatrix(points: Array<{ lng: number; lat: number }>) {
  const n = points.length
  const matrix: number[][] = []
  for (let i = 0; i < n; i++) {
    matrix[i] = []
    for (let j = 0; j < n; j++) {
      const dx = (points[i].lng - points[j].lng) * 111000
      const dy = (points[i].lat - points[j].lat) * 111000
      matrix[i][j] = Math.round(Math.sqrt(dx * dx + dy * dy))
    }
  }
  return Promise.resolve(matrix)
}
