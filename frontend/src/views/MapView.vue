<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
// 百度地图 JS API 由 loadBaiduMapSdk() 动态加载。
declare const BMap: any
import { ordersApi, type Order } from '@/api/orders'
import { vehiclesApi, type Vehicle } from '@/api/vehicles'
import { driversApi, type Driver } from '@/api/drivers'
import { dispatchApi, type DispatchTask } from '@/api/dispatch'
import { vrpApi, type OptimizeResult, type ConfirmRequest } from '@/api/vrp'
import { loadBaiduMapSdk } from '@/map/baidu'
import { useTracking } from '@/composables/tracking'
import { toBaiduCoordinates } from '@/map/coordinates'
import { ORDER_STATUS_LABEL, VEHICLE_STATUS_LABEL, DRIVER_STATUS_LABEL } from '@/constants/status'

// 辅助：生成带颜色的圆形 SVG data URI 图标（用于 BMap.Marker）
function makeCircleIcon(color: string, size = 18) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${color}" stroke="white" stroke-width="2"/></svg>`
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

// ======== 状态 ========
const mapContainer = ref<HTMLElement | null>(null)
let map: any = null  // BMap.Map
// 覆盖物集合，由 BMap.Map 直接 addOverlay/removeOverlay
const ordersOverlays: any[] = []
const taskRouteOverlays: any[] = []
const previewRouteOverlays: any[] = []

const orders = ref<Order[]>([])
const vehicles = ref<Vehicle[]>([])
const drivers = ref<Driver[]>([])
const tasks = ref<DispatchTask[]>([])
const pendingOrders = computed(() => orders.value.filter((order) => order.status === 'PENDING'))

const selectedOrderIds = ref<number[]>([])
const selectedVehicleIds = ref<number[]>([])
const selectedAlgorithm = ref<'CVRP-GA' | 'VRPTW-GA' | 'NSGA-II'>('CVRP-GA')

const optimizing = ref(false)
const confirmLoading = ref(false)
const preview = ref<OptimizeResult | null>(null)
const selectedSolution = ref<string>('')
const assignments = ref<Array<{ vehicleId: number; driverId: number }>>([])

const toast = ref('')
const mapError = ref('')
const depot = { lng: 120.16, lat: 30.26 }
const ROUTE_PALETTE = ['#1b4d7a', '#2e6fa3', '#3e8ab8', '#5fa8c9', '#84c1d9', '#a9d6e5']

const previewLegend = computed(() => {
  if (!preview.value || !selectedSolution.value) return []
  const solution = preview.value.solutions.find((s) => s.id === selectedSolution.value)
  if (!solution) return []
  return solution.routes.map((route, i) => ({
    vehicleId: route.vehicleId,
    color: ROUTE_PALETTE[i % ROUTE_PALETTE.length],
    stopCount: route.stops.length,
  }))
})
const { events } = useTracking()

function mapPoint(lng: number, lat: number) {
  const coordinate = toBaiduCoordinates(lng, lat)
  return new BMap.Point(coordinate.lng, coordinate.lat)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

// ======== 数据加载 ========
async function loadAll(resetSelection = true) {
  const [o, v, d, t] = await Promise.all([
    ordersApi.findAll(),
    vehiclesApi.findAll(),
    driversApi.findAll(),
    dispatchApi.findAll(),
  ])
  orders.value = o as Order[]
  vehicles.value = v as Vehicle[]
  drivers.value = d as Driver[]
  tasks.value = t as DispatchTask[]
  // 默认选中 PENDING 订单
  if (resetSelection) {
    selectedOrderIds.value = orders.value.filter((o) => o.status === 'PENDING').map((o) => o.id)
    selectedVehicleIds.value = vehicles.value.filter((v) => v.status === 'IDLE').map((v) => v.id)
    const availableDrivers = drivers.value.filter((driver) => driver.status === 'AVAILABLE')
    assignments.value = selectedVehicleIds.value.map((vid) => ({
      vehicleId: vid,
      driverId: availableDrivers.shift()?.id ?? 0,
    }))
  } else {
    const pendingIds = new Set(orders.value.filter((order) => order.status === 'PENDING').map((order) => order.id))
    const idleVehicleIds = new Set(vehicles.value.filter((vehicle) => vehicle.status === 'IDLE').map((vehicle) => vehicle.id))
    selectedOrderIds.value = selectedOrderIds.value.filter((id) => pendingIds.has(id))
    selectedVehicleIds.value = selectedVehicleIds.value.filter((id) => idleVehicleIds.has(id))
    assignments.value = assignments.value.map((assignment) => ({
      ...assignment,
      driverId: drivers.value.some((driver) => driver.id === assignment.driverId && driver.status === 'AVAILABLE') ? assignment.driverId : 0,
    }))
  }
}

// ======== 地图 ========
function initMap() {
  if (!mapContainer.value || map) return
  if (typeof BMap === 'undefined') {
    mapError.value = '百度地图 SDK 未加载。请检查网络、浏览器控制台和百度地图 AK 的域名白名单。'
    return
  }
  // Limit the initial view to Hangzhou and use the default street basemap.
  map = new BMap.Map(mapContainer.value)
  map.centerAndZoom(mapPoint(120.1551, 30.2741), 11)
  map.enableScrollWheelZoom(true)
  map.addControl(new BMap.NavigationControl())
}

// ======== 订单点 ========
function drawOrders() {
  if (!map) return
  ordersOverlays.forEach((o) => map!.removeOverlay(o))
  ordersOverlays.length = 0
  orders.value.forEach((o) => {
    if (!o.customer) return
    const c = o.customer  // 提取到局部变量，闭包内 TS 不再报 undefined
    const color = statusColor(o.status)
    const point = mapPoint(c.lng, c.lat)
    const marker = new BMap.Marker(point)
    const icon = new BMap.Icon(
      makeCircleIcon(color),
      new BMap.Size(18, 18),
      { anchor: new BMap.Size(9, 9) }
    )
    marker.setIcon(icon)
    marker.addEventListener('click', () => {
      const info = new BMap.InfoWindow(
        `<b>${escapeHtml(c.name)}</b><br/>订单 #${o.id} · ${o.status}<br/>${escapeHtml(c.address ?? '')}`,
        { width: 220, height: 0 }
      )
      map!.openInfoWindow(info, point)
    })
    map.addOverlay(marker)
    ordersOverlays.push(marker)
  })
}

function drawDepot() {
  if (!map) return
  const label = new BMap.Label('仓库', {
    position: mapPoint(depot.lng, depot.lat),
    offset: new BMap.Size(-18, -12),
  })
  label.setStyle({
    background: '#142e4d',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '12px',
    fontWeight: '600',
  })
  map.addOverlay(label)
}

// ======== 任务路线 ========
async function drawTasks() {
  if (!map) return
  taskRouteOverlays.forEach((o) => map!.removeOverlay(o))
  taskRouteOverlays.length = 0
  const allPoints: any[] = []
  for (const task of tasks.value) {
    if (!task.stops || task.stops.length === 0) {
      try {
        const full = await dispatchApi.findOne(task.id)
        Object.assign(task, full)
      } catch { /* ignore */ }
    }
    if (!task.stops?.length) continue
    const points = [
      mapPoint(depot.lng, depot.lat),
      ...task.stops.map((s) => mapPoint(s.lng, s.lat)),
      mapPoint(depot.lng, depot.lat),
    ]
    allPoints.push(...points)
    const poly = new BMap.Polyline(points, {
      strokeColor: taskPolylineColor(task.status),
      strokeWeight: 4,
      strokeOpacity: 0.7,
    })
    map.addOverlay(poly)
    taskRouteOverlays.push(poly)
    task.stops.forEach((s, i) => {
      const circle = new BMap.Circle(mapPoint(s.lng, s.lat), 8,
        { strokeColor: '#fff', strokeWeight: 1, fillColor: '#1b4d7a', fillOpacity: 1 })
      circle.addEventListener('click', () => {
        const info = new BMap.InfoWindow(
          `停靠点 ${i + 1}<br/>订单 #${s.orderId}<br/>${s.arrived ? '已送达' : '待送达'}`,
          { width: 200, height: 0 }
        )
        map!.openInfoWindow(info, mapPoint(s.lng, s.lat))
      })
      map.addOverlay(circle)
      taskRouteOverlays.push(circle)
    })
  }
  if (allPoints.length > 0) {
    map.setViewport(allPoints)
  }
}

function statusColor(s: Order['status']) {
  return { PENDING: '#8a97a6', ASSIGNED: '#2e6fa3', IN_TRANSIT: '#c07a1a', DELIVERED: '#2e8b57', FAILED: '#b23b32', CANCELLED: '#5a6b7c' }[s] ?? '#8a97a6'
}
function taskPolylineColor(s: DispatchTask['status']) {
  return { CREATED: '#8a97a6', ASSIGNED: '#2e6fa3', STARTED: '#c07a1a', COMPLETED: '#2e8b57', CANCELLED: '#5a6b7c' }[s] ?? '#8a97a6'
}

// ======== 路线优化 ========
async function runOptimize() {
  if (selectedOrderIds.value.length === 0 || selectedVehicleIds.value.length === 0) {
    toast.value = '请至少选择 1 个订单和 1 辆车'
    return
  }
  optimizing.value = true
  preview.value = null
  selectedSolution.value = ''
  try {
    const res = await vrpApi.optimize({
      orderIds: selectedOrderIds.value,
      vehicleIds: selectedVehicleIds.value,
      algorithm: selectedAlgorithm.value,
      depot,
    })
    const raw = res
    console.log('[VRP 原始响应]', JSON.stringify(raw, null, 2))
    const solutions = raw.algorithm === 'NSGA-II'
      ? (raw.solutions ?? []).map((solution) => ({
          id: solution.solutionId,
          algorithm: raw.algorithm,
          totalDistance: solution.totalDistance,
          totalCost: solution.totalCost ?? null,
          feasible: raw.status === 'FOUND',
          routes: solution.routes,
        }))
      : [{
          id: raw.solutionId ?? 'solution-1',
          algorithm: raw.algorithm,
          totalDistance: raw.totalDistance ?? 0,
          totalCost: raw.totalCost ?? null,
          feasible: raw.status === 'FOUND',
          routes: raw.routes ?? [],
        }]
    preview.value = {
      previewId: raw.previewId ?? '',
      solutions: solutions.map((solution) => ({
        ...solution,
        routes: solution.routes.map((route) => ({
          ...route,
          totalDistance: route.totalDistance ?? 0,
          stops: route.stops ?? [],
        })),
      })),
    }
    selectedSolution.value = raw.status === 'FOUND' ? preview.value.solutions[0]?.id ?? '' : ''
    toast.value = raw.status === 'FOUND'
      ? '优化完成，请选择方案并确认'
      : '未找到完整方案，请增加车辆或调整订单'
  } catch (e: any) {
    toast.value = `优化失败：${e?.response?.data?.message ?? e.message}`
  } finally {
    optimizing.value = false
  }
}

function drawSelectedSolution() {
  if (!map) return
  previewRouteOverlays.forEach((o) => map!.removeOverlay(o))
  previewRouteOverlays.length = 0
  if (!preview.value || !selectedSolution.value) return
  const sol = preview.value.solutions.find((s) => s.id === selectedSolution.value)
  if (!sol) return
  const palette = ROUTE_PALETTE
  const allPoints: any[] = []
  sol.routes.forEach((vr, i) => {
    const stops = vr.stops.map((s) => mapPoint(s.lng, s.lat))
    if (stops.length === 0) return
    const points = [mapPoint(depot.lng, depot.lat), ...stops, mapPoint(depot.lng, depot.lat)]
    allPoints.push(...points)
    const color = palette[i % palette.length]
    const poly = new BMap.Polyline(points, {
      strokeColor: color,
      strokeWeight: 4,
      strokeStyle: 'dashed',
      strokeOpacity: 0.8,
    })
    map.addOverlay(poly)
    previewRouteOverlays.push(poly)
    vr.stops.forEach((s, j) => {
      const pt = mapPoint(s.lng, s.lat)
      const circle = new BMap.Circle(pt, 7,
        { strokeColor: '#fff', strokeWeight: 1, fillColor: color, fillOpacity: 1 })
      circle.addEventListener('click', () => {
        const info = new BMap.InfoWindow(
          `车辆 #${vr.vehicleId}<br/>第 ${j + 1} 站<br/>订单 #${s.orderId}`,
          { width: 200, height: 0 }
        )
        map!.openInfoWindow(info, pt)
      })
      map.addOverlay(circle)
      previewRouteOverlays.push(circle)
    })
  })
  if (allPoints.length > 0) map.setViewport(allPoints)
}

watch(selectedSolution, (solutionId) => {
  drawSelectedSolution()
  if (!preview.value || !solutionId) return
  const solution = preview.value.solutions.find((item) => item.id === solutionId)
  if (!solution) return
  const previous = new Map(assignments.value.map((item) => [item.vehicleId, item.driverId]))
  const usedDrivers = new Set<number>()
  assignments.value = solution.routes.map((route) => ({
    vehicleId: route.vehicleId,
    driverId: (() => {
      const previousDriverId = previous.get(route.vehicleId)
      const previousDriver = drivers.value.find((driver) => driver.id === previousDriverId && driver.status === 'AVAILABLE')
      const driver = previousDriver && !usedDrivers.has(previousDriver.id)
        ? previousDriver
        : drivers.value.find((candidate) => candidate.status === 'AVAILABLE' && !usedDrivers.has(candidate.id))
      if (!driver) return 0
      usedDrivers.add(driver.id)
      return driver.id
    })(),
  }))
})

let refreshTimer: ReturnType<typeof setTimeout> | undefined
watch(events, () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(async () => {
    try {
      if (preview.value) {
        preview.value = null
        selectedSolution.value = ''
        previewRouteOverlays.forEach((overlay) => map?.removeOverlay(overlay))
        previewRouteOverlays.length = 0
        toast.value = '任务状态已变化，旧路线方案已清除，请重新优化后再确认'
      }
      await loadAll(false)
      drawOrders()
      await drawTasks()
      drawSelectedSolution()
    } catch (e: any) {
      toast.value = `实时刷新失败：${e?.response?.data?.message ?? e?.message ?? '未知错误'}`
    }
  }, 100)
}, { deep: true })

async function confirmSolution() {
  const selected = preview.value?.solutions.find((solution) => solution.id === selectedSolution.value)
  if (!preview.value?.previewId || !selectedSolution.value || !selected?.feasible) {
    toast.value = '当前没有可确认的完整路线，请重新优化并选择可行方案'
    return
  }
  const payload: ConfirmRequest = {
    previewId: preview.value.previewId,
    solutionId: selectedSolution.value,
    assignments: assignments.value.filter((a) => a.driverId > 0 && a.vehicleId > 0),
  }
  const selectedRoutes = selected.routes
  if (payload.assignments.length !== selectedRoutes.length || new Set(payload.assignments.map((item) => item.driverId)).size !== payload.assignments.length) {
    toast.value = '请为每条路线分配一名不同的可用司机'
    return
  }
  confirmLoading.value = true
  try {
    const res = await vrpApi.confirm(payload)
    toast.value = `已创建 ${res.tasks.length} 个调度任务`
    preview.value = null
    selectedSolution.value = ''
    previewRouteOverlays.forEach((o) => map?.removeOverlay(o)); previewRouteOverlays.length = 0
    await loadAll()
    await drawTasks()
  } catch (e: any) {
    toast.value = `确认失败：${e?.response?.data?.message ?? e.message}`
  } finally {
    confirmLoading.value = false
  }
}

onMounted(async () => {
  const dataLoad = loadAll().then(() => true).catch((e: any) => {
    toast.value = `页面数据加载失败：${e?.response?.data?.message ?? e?.message ?? '未知错误'}`
    return false
  })
  try {
    await loadBaiduMapSdk()
    initMap()
  } catch (e: any) {
    mapError.value = e?.message ?? '百度地图初始化失败'
  }
  const dataLoaded = await dataLoad
  if (!map || !dataLoaded) return
  drawDepot()
  drawOrders()
  await drawTasks()
})

onUnmounted(() => { if (refreshTimer) clearTimeout(refreshTimer) })
</script>

<template>
  <div class="map-page">
    <!-- 左侧控制面板 -->
    <aside class="panel">
      <h3>路线优化操作面板</h3>

      <section class="group">
        <div class="group-title">算法选择</div>
        <select v-model="selectedAlgorithm" class="select">
          <option value="CVRP-GA">CVRP-GA（纯距离优化）</option>
          <option value="VRPTW-GA">VRPTW-GA（带时间窗）</option>
          <option value="NSGA-II">NSGA-II（多目标 Pareto）</option>
        </select>
      </section>

      <section class="group">
        <div class="group-title">订单 ({{ orders.length }})</div>
        <p v-if="!pendingOrders.length" class="empty-hint">没有待分配订单。请先到“基础数据”添加订单。</p>
        <label class="toggle">
          <input type="checkbox" :checked="pendingOrders.length > 0 && selectedOrderIds.length === pendingOrders.length" @change="selectedOrderIds = ($event.target as HTMLInputElement).checked ? pendingOrders.map(o=>o.id) : []" />
          全选
        </label>
        <div class="scroll-list">
          <label v-for="o in orders" :key="o.id" class="chk-item">
            <input type="checkbox" v-model="selectedOrderIds" :value="o.id" :disabled="o.status !== 'PENDING'" />
            <span class="status-dot" :style="{ background: statusColor(o.status) }" />
            #{{ o.id }} {{ o.customer?.name }} <small>({{ ORDER_STATUS_LABEL[o.status] ?? o.status }})</small>
          </label>
        </div>
      </section>

      <section class="group">
        <div class="group-title">可用车辆 ({{ vehicles.filter(v => v.status === 'IDLE').length }})</div>
        <p v-if="!vehicles.some(v => v.status === 'IDLE')" class="empty-hint">没有空闲车辆。请先到“基础数据”添加车辆。</p>
        <div class="scroll-list">
          <label v-for="v in vehicles" :key="v.id" class="chk-item">
            <input type="checkbox" v-model="selectedVehicleIds" :value="v.id" :disabled="v.status !== 'IDLE'" />
            #{{ v.id }} {{ v.plate }} <small>({{ VEHICLE_STATUS_LABEL[v.status] ?? v.status }})</small>
          </label>
        </div>
      </section>

      <button class="btn primary" :disabled="optimizing" @click="runOptimize">
        {{ optimizing ? '计算中...' : '开始优化' }}
      </button>

      <div v-if="preview" class="result-box">
        <div class="result-title">优化结果</div>
        <div class="solutions">
          <label v-for="s in preview.solutions" :key="s.id" class="sol-item">
            <input type="radio" v-model="selectedSolution" :value="s.id" />
            <span>{{ s.algorithm }}</span>
            <span class="badge" :class="{ bad: !s.feasible }">
              {{ s.feasible ? '可行' : '不可行' }}
            </span>
            <span class="dist">{{ s.totalDistance.toFixed(0) }}m</span>
          </label>
        </div>

        <div v-if="selectedSolution" class="driver-assign">
          <div class="group-title mt">司机分配</div>
          <p v-if="!drivers.some(d => d.status === 'AVAILABLE')" class="empty-hint">当前没有可用司机，请先到“基础数据”添加司机。</p>
          <div v-for="(a, idx) in assignments" :key="a.vehicleId" class="assign-row">
            <span>车辆 #{{ a.vehicleId }}</span>
            <select v-model="assignments[idx].driverId" class="mini-select">
              <option :value="0" disabled>请选择司机</option>
              <option v-for="d in drivers.filter(x => x.id === a.driverId || (x.status === 'AVAILABLE' && !assignments.some(other => other.vehicleId !== a.vehicleId && other.driverId === x.id)))" :key="d.id" :value="d.id">
                {{ d.name }} ({{ DRIVER_STATUS_LABEL[d.status] ?? d.status }})
              </option>
            </select>
          </div>
        </div>

        <button class="btn success mt" :disabled="confirmLoading || !preview.previewId || !selectedSolution" @click="confirmSolution">
          {{ confirmLoading ? '提交中...' : '确认并生成调度任务' }}
        </button>
      </div>

      <button class="btn ghost mt" @click="async () => { await loadAll(); drawOrders(); drawTasks() }">刷新任务路线</button>
    </aside>

    <!-- 右侧地图 -->
    <section class="map-area">
      <div ref="mapContainer" class="map" />
      <div v-if="mapError" class="map-error">{{ mapError }}</div>
      <div class="legend">
        <div class="legend-group">
          <strong>订单</strong>
          <span><i class="dot" style="background:#8a97a6" />待分配</span>
          <span><i class="dot" style="background:#2e6fa3" />已分配</span>
          <span><i class="dot" style="background:#c07a1a" />配送中</span>
          <span><i class="dot" style="background:#2e8b57" />已送达</span>
          <span><i class="dot" style="background:#b23b32" />失败</span>
          <span><i class="dot" style="background:#5a6b7c" />已取消</span>
        </div>
        <div class="legend-group">
          <strong>任务路线</strong>
          <span><i class="line" style="background:#8a97a6" />已创建</span>
          <span><i class="line" style="background:#2e6fa3" />已分配</span>
          <span><i class="line" style="background:#c07a1a" />配送中</span>
          <span><i class="line" style="background:#2e8b57" />已完成</span>
          <span><i class="line" style="background:#5a6b7c" />已取消</span>
        </div>
        <div v-if="previewLegend.length" class="legend-group">
          <strong>预览路线</strong>
          <span v-for="route in previewLegend" :key="route.vehicleId">
            <i class="line dashed" :style="{ borderColor: route.color }" />车辆 #{{ route.vehicleId }} · {{ route.stopCount }} 站
          </span>
        </div>
      </div>
      <div v-if="toast" class="toast">{{ toast }}</div>
    </section>
  </div>
</template>

<style scoped>
.map-page { display: grid; grid-template-columns: 380px minmax(0, 1fr); gap: 20px; height: calc(100vh - 108px); }
.panel {
  background: var(--c-card); border-radius: var(--radius); padding: 20px;
  box-shadow: var(--shadow);
  overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
}
.panel h3 {
  margin: 0 0 2px; font-size: 16px; font-weight: 600; color: var(--c-primary-strong);
  padding-bottom: 12px; border-bottom: 1px solid var(--c-line);
}
.group-title { font-size: 12.5px; color: var(--c-text-2); margin-bottom: 8px; font-weight: 600; }
.mt { margin-top: 10px; }
.select {
  width: 100%; padding: 9px 11px; border: 1px solid var(--c-line); border-radius: 8px;
  font-size: 14px; color: var(--c-text); background: var(--c-card);
}
.select:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-soft); }
.scroll-list { max-height: 150px; overflow-y: auto; border: 1px solid var(--c-line); border-radius: 8px; padding: 5px; }
.chk-item { display: flex; align-items: center; gap: 7px; padding: 5px 8px; font-size: 13px; cursor: pointer; border-radius: 6px; color: var(--c-text-2); }
.chk-item:hover { background: var(--c-accent-soft); }
.chk-item small { color: var(--c-text-3); }
.status-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.toggle { font-size: 12.5px; color: var(--c-text-2); display: flex; align-items: center; gap: 5px; }
.btn { width: 100%; padding: 11px 14px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: var(--c-primary); color: #fff; }
.btn.primary:hover:not(:disabled) { background: var(--c-primary-strong); }
.btn.success { background: var(--c-success); color: #fff; }
.btn.success:hover:not(:disabled) { background: #257247; }
.btn.ghost { background: var(--c-neutral-soft); color: var(--c-text-2); }
.btn.ghost:hover { background: #e2e8ee; }
.result-box { background: #f8fafc; border: 1px solid var(--c-line); border-radius: 10px; padding: 12px; }
.result-title { font-weight: 600; color: var(--c-primary-strong); margin-bottom: 10px; font-size: 13.5px; }
.solutions { display: flex; flex-direction: column; gap: 6px; }
.sol-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 8px; background: var(--c-card); border-radius: 6px; }
.badge { padding: 1px 8px; border-radius: 999px; font-size: 11.5px; background: var(--c-success); color: #fff; }
.badge.bad { background: var(--c-warn); }
.dist { margin-left: auto; color: var(--c-text-2); font-size: 12px; font-variant-numeric: tabular-nums; }
.driver-assign { border-top: 1px dashed var(--c-line); padding-top: 10px; }
.assign-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; margin-bottom: 5px; color: var(--c-text-2); }
.assign-row select, .mini-select { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--c-line); font-size: 13px; }

.map-area { position: relative; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); }
.map { width: 100%; height: 100%; }
.map-error { position: absolute; top: 12px; left: 12px; right: 12px; padding: 12px 16px; border-radius: 8px; background: var(--c-warn-soft); color: #7a4b00; font-size: 13.5px; z-index: 2; }
.legend {
  position: absolute; bottom: 14px; left: 14px;
  background: rgba(255, 255, 255, 0.95); padding: 12px 16px; border-radius: 8px;
  box-shadow: var(--shadow); font-size: 12.5px;
  display: flex; flex-direction: column; gap: 8px; max-width: 480px;
}
.legend-group { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.legend-group strong { color: var(--c-primary-strong); font-size: 12px; flex: none; }
.legend span { display: inline-flex; align-items: center; gap: 5px; color: var(--c-text-2); }
.legend i.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.legend i.line { width: 16px; height: 3px; border-radius: 2px; display: inline-block; }
.legend i.line.dashed { height: 0; background: none !important; border-top: 3px dashed; border-radius: 0; }
.toast { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); background: rgba(20, 46, 77, 0.88); color: #fff; padding: 9px 18px; border-radius: 999px; font-size: 13.5px; z-index: 1000; }
.empty-hint { margin: 4px 0; color: var(--c-warn); font-size: 12.5px; line-height: 1.5; }
@media (max-width: 900px) { .map-page { grid-template-columns: 1fr; height: auto; } .panel { max-height: 65vh; } .map-area { height: 60vh; min-height: 420px; } }
</style>
