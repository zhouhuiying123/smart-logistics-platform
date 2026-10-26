<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { dispatchApi, type DispatchTask } from '@/api/dispatch'
import { TASK_STATUS_LABEL } from '@/constants/status'
import { useTracking } from '@/composables/tracking'

const tasks = ref<DispatchTask[]>([])
const loading = ref(false)
const error = ref('')
const updatingId = ref<number | null>(null)
const { events } = useTracking()
let refreshTimer: ReturnType<typeof setTimeout> | undefined

const sortedTasks = computed(() => [...tasks.value].sort((a, b) => b.id - a.id))

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = await dispatchApi.findAll()
    error.value = ''
  } catch (e: any) {
    error.value = e?.response?.data?.message?.toString?.() ?? e?.message ?? '任务加载失败'
  } finally {
    loading.value = false
  }
}

function actions(task: DispatchTask) {
  if (task.status === 'ASSIGNED') return [
    { status: 'STARTED' as const, label: '开始配送', kind: 'primary' },
    { status: 'CANCELLED' as const, label: '取消任务', kind: 'danger' },
  ]
  if (task.status === 'STARTED') return [
    { status: 'COMPLETED' as const, label: '完成配送', kind: 'primary' },
    { status: 'CANCELLED' as const, label: '取消任务', kind: 'danger' },
  ]
  return []
}

async function transition(task: DispatchTask, status: 'STARTED' | 'COMPLETED' | 'CANCELLED') {
  const label = status === 'STARTED' ? '开始配送' : status === 'COMPLETED' ? '完成配送' : '取消任务'
  if (!window.confirm(`确认${label} #${task.id}？`)) return
  updatingId.value = task.id
  error.value = ''
  try {
    await dispatchApi.update(task.id, { status })
    await loadTasks()
  } catch (e: any) {
    error.value = e?.response?.data?.message?.toString?.() ?? e?.message ?? `${label}失败`
  } finally {
    updatingId.value = null
  }
}

watch(events, () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => { void loadTasks() }, 100)
}, { deep: true })

onMounted(loadTasks)
onUnmounted(() => { if (refreshTimer) clearTimeout(refreshTimer) })
</script>

<template>
  <main class="tasks-page">
    <header class="heading"><div><h1>调度任务</h1><p>查看路线停靠点并推进配送状态；完成与取消会同步释放车辆和司机。</p></div><button class="refresh" :disabled="loading" @click="loadTasks">{{ loading ? '刷新中…' : '刷新' }}</button></header>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!loading && !tasks.length && !error" class="empty">暂无调度任务。先到地图可视化页面选择订单和车辆，优化路线后确认方案。</p>
    <section v-for="task in sortedTasks" :key="task.id" class="task-card">
      <div class="task-top">
        <div><strong>任务 #{{ task.id }}</strong><span class="status" :class="task.status.toLowerCase()">{{ TASK_STATUS_LABEL[task.status] ?? task.status }}</span></div>
        <div class="task-meta">{{ task.vehicle?.plate ?? `车辆 #${task.vehicleId}` }} · {{ task.driver?.name ?? `司机 #${task.driverId}` }}<span v-if="task.totalDist"> · {{ (task.totalDist / 1000).toFixed(1) }} km</span></div>
      </div>
      <ol class="stops">
        <li v-for="stop in task.stops ?? []" :key="stop.id" :class="{ arrived: stop.arrived }">
          <span class="stop-number">{{ stop.seq }}</span><span>订单 #{{ stop.orderId }} · {{ stop.order?.customer?.name ?? stop.order?.customer?.address ?? `${stop.lng.toFixed(4)}, ${stop.lat.toFixed(4)}` }}</span>
          <span class="stop-state">{{ stop.arrived ? '已送达' : '待送达' }}</span>
        </li>
        <li v-if="!task.stops?.length" class="no-stops">该任务没有关联停靠点</li>
      </ol>
      <footer class="task-actions">
        <button v-for="action in actions(task)" :key="action.status" :class="action.kind" :disabled="updatingId === task.id" @click="transition(task, action.status)">{{ updatingId === task.id ? '处理中…' : action.label }}</button>
        <span v-if="task.status === 'COMPLETED'" class="done">已完成</span>
        <span v-else-if="task.status === 'CANCELLED'" class="muted">已取消</span>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.tasks-page { display: flex; flex-direction: column; gap: 18px; }
.heading { display: flex; align-items: center; justify-content: space-between; }
.heading h1 { margin: 0; color: var(--c-primary-strong); font-size: 24px; font-weight: 600; }
.heading p { margin: 8px 0 0; color: var(--c-text-2); font-size: 14px; }
.refresh, .task-actions button {
  border: 1px solid var(--c-line); border-radius: 8px; padding: 9px 16px;
  background: var(--c-card); color: var(--c-text-2); cursor: pointer; font-size: 14px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.refresh:hover:not(:disabled), .task-actions button:hover:not(:disabled) { border-color: var(--c-accent); color: var(--c-primary); }
.refresh:disabled, .task-actions button:disabled { opacity: 0.55; cursor: wait; }
.task-card { background: var(--c-card); border-radius: var(--radius); padding: 18px 22px; box-shadow: var(--shadow); }
.task-top, .task-top > div:first-child, .task-actions { display: flex; align-items: center; gap: 10px; }
.task-top { justify-content: space-between; }
.task-top strong { color: var(--c-text); font-size: 15px; }
.status { font-size: 12px; padding: 3px 10px; border-radius: 999px; background: var(--c-neutral-soft); color: var(--c-neutral); font-weight: 500; }
.status.assigned { background: var(--c-accent-soft); color: var(--c-accent); }
.status.started { background: var(--c-warn-soft); color: var(--c-warn); }
.status.completed { background: var(--c-success-soft); color: var(--c-success); }
.status.cancelled { background: var(--c-danger-soft); color: var(--c-danger); }
.task-meta { font-size: 13px; color: var(--c-text-3); }
.stops { list-style: none; margin: 14px 0 10px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.stops li { display: flex; align-items: center; gap: 10px; color: var(--c-text-2); font-size: 13.5px; }
.stop-number { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--c-accent-soft); color: var(--c-primary); font-size: 12px; font-weight: 600; flex: none; }
.arrived .stop-number { background: var(--c-success-soft); color: var(--c-success); }
.stop-state { margin-left: auto; font-size: 12px; color: var(--c-text-3); }
.arrived .stop-state { color: var(--c-success); }
.no-stops { color: var(--c-warn) !important; }
.task-actions { border-top: 1px solid var(--c-line); padding-top: 14px; justify-content: flex-end; }
.task-actions .primary { background: var(--c-primary); border-color: var(--c-primary); color: #fff; }
.task-actions .primary:hover:not(:disabled) { background: var(--c-primary-strong); border-color: var(--c-primary-strong); }
.task-actions .danger { color: var(--c-danger); }
.task-actions .danger:hover:not(:disabled) { border-color: var(--c-danger); color: var(--c-danger); }
.done { color: var(--c-success); font-size: 13px; }
.muted { color: var(--c-text-3); font-size: 13px; }
.error { padding: 11px 14px; background: var(--c-danger-soft); border-radius: 8px; color: var(--c-danger); font-size: 13.5px; white-space: pre-wrap; }
.empty { background: var(--c-card); border-radius: var(--radius); padding: 48px; text-align: center; color: var(--c-text-3); font-size: 14px; box-shadow: var(--shadow); }
@media (max-width: 600px) { .task-top { align-items: flex-start; flex-direction: column; } .heading { align-items: flex-start; } }
</style>
