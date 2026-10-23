<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { ordersApi, type Order } from '@/api/orders'
import { vehiclesApi, type Vehicle } from '@/api/vehicles'
import { driversApi, type Driver } from '@/api/drivers'
import { dispatchApi, type DispatchTask } from '@/api/dispatch'
import { useTracking } from '@/composables/tracking'

use([CanvasRenderer, PieChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const orders = ref<Order[]>([])
const vehicles = ref<Vehicle[]>([])
const drivers = ref<Driver[]>([])
const tasks = ref<DispatchTask[]>([])

const { events } = useTracking()

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
}

// ======== 统计卡片 ========
const stats = computed(() => {
  const total = orders.value.length
  const inTransit = orders.value.filter((o) => o.status === 'IN_TRANSIT').length
  const delivered = orders.value.filter((o) => o.status === 'DELIVERED').length
  const doneRate = total ? ((delivered / total) * 100).toFixed(1) : '0.0'
  const todayTasks = tasks.value.filter((t) => {
    if (!t.createdAt) return false
    return new Date(t.createdAt).toDateString() === new Date().toDateString()
  }).length
  return {
    total,
    inTransit,
    delivered,
    doneRate,
    todayTasks,
    idles: vehicles.value.filter((v) => v.status === 'IDLE').length,
    availDrivers: drivers.value.filter((d) => d.status === 'AVAILABLE').length,
  }
})

// ======== 订单状态饼图 ========
const orderPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { orient: 'vertical', right: 10, top: 'center', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 12 } },
  color: ['#e67e22', '#3498db', '#9b59b6', '#27ae60', '#c0392b', '#7f8c8d'],
  series: [{
    name: '订单状态',
    type: 'pie',
    radius: ['45%', '70%'],
    center: ['35%', '50%'],
    avoidLabelOverlap: true,
    itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    label: { show: true, formatter: '{b}\n{c}单', fontSize: 11 },
    data: Object.entries(
      orders.value.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {} as Record<string, number>),
    ).map(([k, v]) => ({ name: k, value: v })),
  }],
}))

// ======== 任务状态饼图 ========
const taskPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { orient: 'vertical', right: 10, top: 'center', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 12 } },
  color: ['#95a5a6', '#3498db', '#f39c12', '#27ae60', '#c0392b'],
  series: [{
    name: '调度任务',
    type: 'pie',
    radius: ['45%', '70%'],
    center: ['35%', '50%'],
    itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    label: { show: true, formatter: '{b}\n{c}个', fontSize: 11 },
    data: Object.entries(
      tasks.value.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc }, {} as Record<string, number>),
    ).map(([k, v]) => ({ name: k, value: v })),
  }],
}))

// ======== 车辆状态条形图 ========
const vehicleBarOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 30, bottom: 30, left: 80, right: 20 },
  xAxis: { type: 'value' },
  yAxis: {
    type: 'category',
    data: ['MAINTENANCE', 'ON_DUTY', 'IDLE'],
    axisLabel: { fontSize: 12 },
  },
  series: [{
    type: 'bar',
    barWidth: 18,
    label: { show: true, position: 'right', fontSize: 12 },
    itemStyle: { borderRadius: [0, 4, 4, 0] },
    data: [
      vehicles.value.filter((v) => v.status === 'MAINTENANCE').length,
      vehicles.value.filter((v) => v.status === 'ON_DUTY').length,
      vehicles.value.filter((v) => v.status === 'IDLE').length,
    ],
  }],
}))

// ======== 任务时间线（最近 10 条） ========
const recentTasks = computed(() =>
  [...tasks.value]
    .sort((a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? ''))
    .slice(0, 10),
)

function statusBadge(s: DispatchTask['status']) {
  const map: Record<string, string> = { CREATED: '#95a5a6', ASSIGNED: '#3498db', STARTED: '#f39c12', COMPLETED: '#27ae60', CANCELLED: '#c0392b' }
  return map[s] ?? '#999'
}

// 收到 WebSocket 事件时刷新
watch(events, () => { loadAll() }, { deep: true })

onMounted(loadAll)
</script>

<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <section class="cards">
      <div class="card accent-1">
        <div class="card-label">今日调度任务</div>
        <div class="card-value">{{ stats.todayTasks }}</div>
        <div class="card-sub">个</div>
      </div>
      <div class="card accent-2">
        <div class="card-label">进行中订单</div>
        <div class="card-value">{{ stats.inTransit }}</div>
        <div class="card-sub">单</div>
      </div>
      <div class="card accent-3">
        <div class="card-label">总完成率</div>
        <div class="card-value">{{ stats.doneRate }}<span class="pct">%</span></div>
        <div class="card-sub">DELIVERED / 总计</div>
      </div>
      <div class="card accent-4">
        <div class="card-label">空闲车辆 / 可用司机</div>
        <div class="card-value">{{ stats.idles }} <span class="divider">|</span> {{ stats.availDrivers }}</div>
        <div class="card-sub">运力储备</div>
      </div>
    </section>

    <!-- 图表行 1 -->
    <section class="charts">
      <div class="chart-card">
        <h4>订单状态分布</h4>
        <VChart class="chart" :option="orderPieOption" autoresize />
      </div>
      <div class="chart-card">
        <h4>调度任务状态分布</h4>
        <VChart class="chart" :option="taskPieOption" autoresize />
      </div>
    </section>

    <!-- 图表行 2 -->
    <section class="charts">
      <div class="chart-card">
        <h4>车辆运行状态</h4>
        <VChart class="chart" :option="vehicleBarOption" autoresize />
      </div>
      <div class="chart-card timeline">
        <h4>最近调度任务</h4>
        <div class="tl-list">
          <div v-for="t in recentTasks" :key="t.id" class="tl-item">
            <span class="tl-id">#{{ t.id }}</span>
            <span class="tl-vehicle">{{ t.vehicle?.plate ?? '—' }}</span>
            <span class="tl-driver">{{ t.driver?.name ?? '—' }}</span>
            <span class="tl-status" :style="{ background: statusBadge(t.status) }">{{ t.status }}</span>
            <span class="tl-dist">{{ t.totalDist ? (t.totalDist / 1000).toFixed(1) + 'km' : '—' }}</span>
          </div>
          <div v-if="recentTasks.length === 0" class="tl-empty">暂无调度任务</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 16px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.card {
  background: #fff; border-radius: 10px; padding: 18px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  border-left: 4px solid transparent;
}
.card.accent-1 { border-left-color: #2e75b6; }
.card.accent-2 { border-left-color: #9b59b6; }
.card.accent-3 { border-left-color: #27ae60; }
.card.accent-4 { border-left-color: #f39c12; }
.card-label { font-size: 13px; color: #666; margin-bottom: 6px; }
.card-value { font-size: 30px; font-weight: 700; color: #1f4e79; line-height: 1; }
.card-value .pct { font-size: 16px; margin-left: 2px; }
.card-value .divider { font-size: 14px; margin: 0 6px; color: #bbb; }
.card-sub { font-size: 11.5px; color: #999; margin-top: 4px; }

.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.chart-card {
  background: #fff; border-radius: 10px; padding: 14px 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  display: flex; flex-direction: column;
}
.chart-card h4 { margin: 0 0 8px; font-size: 14px; color: #1f4e79; }
.chart { height: 240px; }
.timeline { min-height: 240px; }
.tl-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.tl-item {
  display: grid; grid-template-columns: 50px 1fr 1fr 90px 70px;
  align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px;
  font-size: 12.5px; border-bottom: 1px solid #f0f0f0;
}
.tl-item:last-child { border-bottom: none; }
.tl-id { color: #999; font-weight: 600; }
.tl-status { color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 10px; text-align: center; justify-self: end; }
.tl-dist { text-align: right; color: #888; font-size: 12px; }
.tl-empty { color: #bbb; padding: 40px 0; text-align: center; font-size: 13px; }
</style>
