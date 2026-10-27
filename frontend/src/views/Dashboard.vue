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
import { ORDER_STATUS_LABEL, TASK_STATUS_LABEL } from '@/constants/status'

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
  color: ['#8a97a6', '#2e6fa3', '#c07a1a', '#2e8b57', '#b23b32', '#5a6b7c'],
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
    ).map(([k, v]) => ({ name: ORDER_STATUS_LABEL[k] ?? k, value: v })),
  }],
}))

// ======== 任务状态饼图 ========
const taskPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { orient: 'vertical', right: 10, top: 'center', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 12 } },
  color: ['#8a97a6', '#2e6fa3', '#c07a1a', '#2e8b57', '#b23b32'],
  series: [{
    name: '调度任务',
    type: 'pie',
    radius: ['45%', '70%'],
    center: ['35%', '50%'],
    itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    label: { show: true, formatter: '{b}\n{c}个', fontSize: 11 },
    data: Object.entries(
      tasks.value.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc }, {} as Record<string, number>),
    ).map(([k, v]) => ({ name: TASK_STATUS_LABEL[k] ?? k, value: v })),
  }],
}))

// ======== 车辆状态条形图 ========
const vehicleBarOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { top: 30, bottom: 30, left: 80, right: 20 },
  xAxis: { type: 'value' },
  yAxis: {
    type: 'category',
    data: ['维护中', '出车中', '空闲'],
    axisLabel: { fontSize: 12 },
  },
  series: [{
    type: 'bar',
    barWidth: 18,
    label: { show: true, position: 'right', fontSize: 12 },
    itemStyle: { borderRadius: [0, 4, 4, 0], color: '#2e6fa3' },
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
  const map: Record<string, string> = { CREATED: '#8a97a6', ASSIGNED: '#2e6fa3', STARTED: '#c07a1a', COMPLETED: '#2e8b57', CANCELLED: '#5a6b7c' }
  return map[s] ?? '#8a97a6'
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
        <div class="card-sub">已送达订单 / 订单总数</div>
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
            <span class="tl-status" :style="{ background: statusBadge(t.status) }">{{ TASK_STATUS_LABEL[t.status] ?? t.status }}</span>
            <span class="tl-dist">{{ t.totalDist ? (t.totalDist / 1000).toFixed(1) + 'km' : '—' }}</span>
          </div>
          <div v-if="recentTasks.length === 0" class="tl-empty">暂无调度任务</div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 20px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.card {
  background: var(--c-card); border-radius: var(--radius); padding: 22px 24px;
  box-shadow: var(--shadow);
  border-top: 3px solid var(--c-primary);
}
.card-label { font-size: 13px; color: var(--c-text-2); margin-bottom: 10px; }
.card-value { font-size: 32px; font-weight: 700; color: var(--c-primary-strong); line-height: 1; font-variant-numeric: tabular-nums; }
.card-value .pct { font-size: 17px; margin-left: 2px; }
.card-value .divider { font-size: 15px; margin: 0 8px; color: var(--c-line); }
.card-sub { font-size: 12.5px; color: var(--c-text-3); margin-top: 8px; }

.charts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.chart-card {
  background: var(--c-card); border-radius: var(--radius); padding: 18px 20px;
  box-shadow: var(--shadow);
  display: flex; flex-direction: column;
}
.chart-card h4 {
  margin: 0 0 12px; font-size: 15px; font-weight: 600; color: var(--c-text);
  display: flex; align-items: center; gap: 8px;
}
.chart-card h4::before {
  content: ""; width: 3px; height: 14px; border-radius: 2px;
  background: var(--c-primary);
}
.chart { height: 250px; }
.timeline { min-height: 250px; }
.tl-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
.tl-item {
  display: grid; grid-template-columns: 52px 1fr 1fr 92px 72px;
  align-items: center; gap: 8px;
  padding: 9px 10px;
  font-size: 13px; border-bottom: 1px solid var(--c-line);
  color: var(--c-text-2);
}
.tl-item:last-child { border-bottom: none; }
.tl-id { color: var(--c-text-3); font-weight: 600; }
.tl-status { color: #fff; font-size: 11.5px; padding: 2px 9px; border-radius: 999px; text-align: center; justify-self: end; }
.tl-dist { text-align: right; color: var(--c-text-3); font-size: 12.5px; }
.tl-empty { color: var(--c-text-3); padding: 48px 0; text-align: center; font-size: 13.5px; }
</style>
