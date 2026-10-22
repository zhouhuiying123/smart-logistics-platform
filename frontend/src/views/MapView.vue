<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ordersApi, type Order } from '@/api/orders'
import { vehiclesApi, type Vehicle } from '@/api/vehicles'
import { driversApi, type Driver } from '@/api/drivers'
import { dispatchApi, type DispatchTask } from '@/api/dispatch'
import { vrpApi, type OptimizeResult, type ConfirmRequest } from '@/api/vrp'

// ======== 状态 ========
const mapContainer = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let ordersLayer: L.LayerGroup | null = null
let tasksLayer: L.LayerGroup | null = null
let routeLayer: L.LayerGroup | null = null

const orders = ref<Order[]>([])
const vehicles = ref<Vehicle[]>([])
const drivers = ref<Driver[]>([])
const tasks = ref<DispatchTask[]>([])

const selectedOrderIds = ref<number[]>([])
const selectedVehicleIds = ref<number[]>([])
const selectedAlgorithm = ref<'CVRP-GA' | 'VRPTW-GA' | 'NSGA-II'>('CVRP-GA')

const optimizing = ref(false)
const confirmLoading = ref(false)
const preview = ref<OptimizeResult | null>(null)
const selectedSolution = ref<string>('')
const assignments = ref<Array<{ vehicleId: number; driverId: number }>>([])
const currentTaskId = ref<number | null>(null)

const toast = ref('')

// ======== 数据加载 ========
async function loadAll() {
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
  selectedOrderIds.value = orders.value.filter((o) => o.status === 'PENDING').map((o) => o.id)
  selectedVehicleIds.value = vehicles.value.filter((v) => v.status === 'IDLE').map((v) => v.id)
  // 默认分配：每辆车分配一个可用司机
  assignments.value = selectedVehicleIds.value.map((vid) => ({
    vehicleId: vid,
    driverId: drivers.value.find((d) => d.status === 'AVAILABLE')?.id ?? 0,
  }))
}

// ======== 地图 ========
function initMap() {
  if (!mapContainer.value || map) return
  map = L.map(mapContainer.value, { zoomControl: true }).setView([30.0, 120.0], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map)
  ordersLayer = L.layerGroup().addTo(map)
  tasksLayer = L.layerGroup().addTo(map)
  routeLayer = L.layerGroup().addTo(map)
}

// ======== 订单点 ========
function drawOrders() {
  ordersLayer?.clearLayers()
  orders.value.forEach((o) => {
    if (!o.customer) return
    const color = statusColor(o.status)
    const icon = L.divIcon({
      className: 'order-marker',
      html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
    })
    L.marker([o.customer.lat, o.customer.lng], { icon })
      .bindPopup(`<b>${o.customer.name}</b><br/>订单 #${o.id} · ${o.status}<br/>${o.customer.address ?? ''}`)
      .addTo(ordersLayer!)
  })
}

// ======== 任务路线 ========
async function drawTasks() {
  tasksLayer?.clearLayers()
  routeLayer?.clearLayers()
  for (const task of tasks.value) {
    if (!task.stops || task.stops.length === 0) {
      try {
        const full = await dispatchApi.findOne(task.id)
        Object.assign(task, full)
      } catch { /* ignore */ }
    }
    if (!task.stops?.length) continue
    const latlngs = task.stops.map((s) => [s.lat, s.lng] as [number, number])
    L.polyline(latlngs, { color: taskPolylineColor(task.status), weight: 4, opacity: 0.7 })
      .addTo(routeLayer!)
      .bindTooltip(`任务 #${task.id} · ${task.status}`, { permanent: false })
    task.stops.forEach((s, i) => {
      L.circleMarker([s.lat, s.lng], { radius: 6, color: '#fff', fillColor: '#1f4e79', fillOpacity: 1, weight: 1 })
        .bindPopup(`停靠点 ${i + 1}<br/>订单 #${s.orderId}<br/>${s.arrived ? '已送达' : '待送达'}`)
        .addTo(tasksLayer!)
    })
  }
  // 自动适配视图
  if (routeLayer && routeLayer.getLayers().length > 0) {
    const group = L.featureGroup([...routeLayer.getLayers(), ...tasksLayer.getLayers()])
    map?.fitBounds(group.getBounds().pad(0.2))
  }
}

function statusColor(s: Order['status']) {
  return { PENDING: '#e67e22', ASSIGNED: '#3498db', IN_TRANSIT: '#9b59b6', DELIVERED: '#27ae60', FAILED: '#c0392b', CANCELLED: '#7f8c8d' }[s] ?? '#95a5a6'
}
function taskPolylineColor(s: DispatchTask['status']) {
  return { CREATED: '#95a5a6', ASSIGNED: '#3498db', STARTED: '#f39c12', COMPLETED: '#27ae60', CANCELLED: '#c0392b' }[s] ?? '#95a5a6'
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
    })
    preview.value = res as OptimizeResult
    selectedSolution.value = (preview.value!.solutions[0]?.id ?? '') as string
    // 自动填充司机分配
    assignments.value = selectedVehicleIds.value.map((vid, idx) => ({
      vehicleId: vid,
      driverId: assignments.value[idx]?.driverId ?? drivers.value.find((d) => d.status === 'AVAILABLE')?.id ?? 0,
    }))
    toast.value = '优化完成，请选择方案并确认'
  } catch (e: any) {
    toast.value = `优化失败：${e?.response?.data?.message ?? e.message}`
  } finally {
    optimizing.value = false
  }
}

function drawSelectedSolution() {
  routeLayer?.clearLayers()
  if (!preview.value || !selectedSolution.value) return
  const sol = preview.value.solutions.find((s) => s.id === selectedSolution.value)
  if (!sol) return
  const palette = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c']
  sol.vehicles.forEach((vr, i) => {
    const latlngs = vr.stops.map((s) => [s.lat, s.lng] as [number, number])
    if (latlngs.length === 0) return
    const color = palette[i % palette.length]
    L.polyline(latlngs, { color, weight: 4, dashArray: '6 6', opacity: 0.8 })
      .addTo(routeLayer!)
      .bindTooltip(`车辆 #${vr.vehicleId} · ${vr.distance.toFixed(0)}m`, { permanent: false })
    vr.stops.forEach((s, j) => {
      L.circleMarker([s.lat, s.lng], { radius: 5, color: '#fff', fillColor: color, fillOpacity: 1, weight: 1 })
        .bindPopup(`车辆 #${vr.vehicleId}<br/>第 ${j + 1} 站<br/>订单 #${s.orderId}`)
        .addTo(routeLayer!)
    })
  })
  const group = L.featureGroup(routeLayer!.getLayers())
  map?.fitBounds(group.getBounds().pad(0.2))
}

watch(selectedSolution, drawSelectedSolution)

async function confirmSolution() {
  if (!preview.value || !selectedSolution.value) { toast.value = '请先优化并选择方案'; return }
  const payload: ConfirmRequest = {
    previewId: preview.value.previewId,
    solutionId: selectedSolution.value,
    assignments: assignments.value.filter((a) => a.driverId > 0 && a.vehicleId > 0),
  }
  if (payload.assignments.length === 0) { toast.value = '请至少完成一个车辆-司机分配'; return }
  confirmLoading.value = true
  try {
    const res = await vrpApi.confirm(payload)
    toast.value = `已创建 ${(res as any).taskIds?.length ?? 0} 个调度任务`
    preview.value = null
    selectedSolution.value = ''
    routeLayer?.clearLayers()
    await loadAll()
    await drawTasks()
  } catch (e: any) {
    toast.value = `确认失败：${e?.response?.data?.message ?? e.message}`
  } finally {
    confirmLoading.value = false
  }
}

const previewSummary = computed(() => {
  if (!preview.value) return ''
  return preview.value.solutions
    .map((s) => `${s.id}: ${s.algorithm} · ${s.totalDistance.toFixed(0)}m · ${s.feasible ? '可行' : '不可行'}`)
    .join(' | ')
})

onMounted(async () => {
  initMap()
  await loadAll()
  drawOrders()
  drawTasks()
})
</script>

<template>
  <div class="map-page">
    <!-- 左侧控制面板 -->
    <aside class="panel">
      <h3>📍 路线优化操作面板</h3>

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
        <label class="toggle">
          <input type="checkbox" :checked="selectedOrderIds.length === orders.length" @change="selectedOrderIds = $event.target.checked ? orders.map(o=>o.id) : []" />
          全选
        </label>
        <div class="scroll-list">
          <label v-for="o in orders" :key="o.id" class="chk-item">
            <input type="checkbox" v-model="selectedOrderIds" :value="o.id" />
            <span class="status-dot" :style="{ background: statusColor(o.status) }" />
            #{{ o.id }} {{ o.customer?.name }} <small>({{ o.status }})</small>
          </label>
        </div>
      </section>

      <section class="group">
        <div class="group-title">可用车辆 ({{ vehicles.length }})</div>
        <div class="scroll-list">
          <label v-for="v in vehicles" :key="v.id" class="chk-item">
            <input type="checkbox" v-model="selectedVehicleIds" :value="v.id" :disabled="v.status !== 'IDLE'" />
            #{{ v.id }} {{ v.plate }} <small>({{ v.status }})</small>
          </label>
        </div>
      </section>

      <button class="btn primary" :disabled="optimizing" @click="runOptimize">
        {{ optimizing ? '计算中...' : '🚀 开始优化' }}
      </button>

      <div v-if="preview" class="result-box">
        <div class="result-title">✅ 优化结果</div>
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
          <div v-for="(a, idx) in assignments" :key="a.vehicleId" class="assign-row">
            <span>车辆 #{{ a.vehicleId }}</span>
            <select v-model="assignments[idx].driverId" class="mini-select">
              <option v-for="d in drivers.filter(x => x.status === 'AVAILABLE' || x.id === a.driverId)" :key="d.id" :value="d.id">
                {{ d.name }} ({{ d.status }})
              </option>
            </select>
          </div>
        </div>

        <button class="btn success mt" :disabled="confirmLoading" @click="confirmSolution">
          {{ confirmLoading ? '提交中...' : '✅ 确认并生成调度任务' }}
        </button>
      </div>

      <button class="btn ghost mt" @click="drawTasks">🔄 刷新任务路线</button>
    </aside>

    <!-- 右侧地图 -->
    <section class="map-area">
      <div ref="mapContainer" class="map" />
      <div class="legend">
        <strong>图例</strong>
        <span><i style="background:#e67e22" />PENDING</span>
        <span><i style="background:#3498db" />ASSIGNED</span>
        <span><i style="background:#9b59b6" />IN_TRANSIT</span>
        <span><i style="background:#27ae60" />DELIVERED</span>
        <span><i style="background:#c0392b" />FAILED</span>
        <span><i style="background:#7f8c8d" />CANCELLED</span>
      </div>
      <div v-if="toast" class="toast">{{ toast }}</div>
    </section>
  </div>
</template>

<style scoped>
.map-page { display: grid; grid-template-columns: 360px 1fr; gap: 16px; height: calc(100vh - 88px); }
.panel {
  background: #fff; border-radius: 10px; padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
}
.panel h3 { margin: 0 0 4px; font-size: 15px; color: #1f4e79; }
.group-title { font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600; }
.mt { margin-top: 10px; }
.select { width: 100%; padding: 7px 10px; border: 1px solid #d0d7de; border-radius: 6px; font-size: 13px; }
.scroll-list { max-height: 140px; overflow-y: auto; border: 1px solid #eee; border-radius: 6px; padding: 4px; }
.chk-item { display: flex; align-items: center; gap: 6px; padding: 3px 6px; font-size: 12.5px; cursor: pointer; border-radius: 4px; }
.chk-item:hover { background: #f0f5ff; }
.status-dot { width: 10px; height: 10px; border-radius: 50%; }
.toggle { font-size: 12px; color: #666; display: flex; align-items: center; gap: 4px; }
.btn { width: 100%; padding: 10px 12px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.primary { background: #2e75b6; color: #fff; }
.btn.primary:hover:not(:disabled) { background: #1f4e79; }
.btn.success { background: #27ae60; color: #fff; }
.btn.success:hover:not(:disabled) { background: #1e8449; }
.btn.ghost { background: #f0f2f5; color: #555; }
.result-box { background: #f8fafb; border: 1px solid #e1e8ef; border-radius: 8px; padding: 10px; }
.result-title { font-weight: 600; color: #2e75b6; margin-bottom: 8px; font-size: 13px; }
.solutions { display: flex; flex-direction: column; gap: 6px; }
.sol-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 4px 6px; background: #fff; border-radius: 4px; }
.badge { padding: 1px 6px; border-radius: 10px; font-size: 11px; background: #27ae60; color: #fff; }
.badge.bad { background: #e67e22; }
.dist { margin-left: auto; color: #666; font-size: 11.5px; }
.driver-assign { border-top: 1px dashed #ccc; padding-top: 8px; }
.assign-row { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
.assign-row select { flex: 1; padding: 5px 6px; border-radius: 4px; border: 1px solid #ddd; }
.mini-select { flex: 1; padding: 5px 6px; border-radius: 4px; border: 1px solid #ddd; }

.map-area { position: relative; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
.map { width: 100%; height: 100%; }
.legend {
  position: absolute; bottom: 12px; left: 12px;
  background: rgba(255,255,255,0.95); padding: 10px 14px; border-radius: 6px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.1); font-size: 12px;
  display: flex; flex-wrap: wrap; gap: 10px; max-width: 320px;
}
.legend strong { color: #1f4e79; margin-right: 4px; }
.legend span { display: flex; align-items: center; gap: 4px; }
.legend i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.toast { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.75); color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; z-index: 1000; }
</style>
