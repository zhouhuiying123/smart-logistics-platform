<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { customersApi, type Customer } from '@/api/customers'
import { ordersApi, type Order } from '@/api/orders'
import { vehiclesApi, type Vehicle } from '@/api/vehicles'
import { driversApi, type Driver } from '@/api/drivers'
import { ORDER_STATUS_LABEL, VEHICLE_STATUS_LABEL, DRIVER_STATUS_LABEL } from '@/constants/status'

type Tab = 'customers' | 'orders' | 'vehicles' | 'drivers'
type Row = Record<string, any>

function formatCell(row: Row, key: string) {
  const v = row[key]
  if (key !== 'status' || v == null) return v ?? '—'
  if (activeTab.value === 'orders') return ORDER_STATUS_LABEL[v] ?? v
  if (activeTab.value === 'vehicles') return VEHICLE_STATUS_LABEL[v] ?? v
  return DRIVER_STATUS_LABEL[v] ?? v
}
type Field = { key: string; label: string; type?: string; min?: number; step?: number; required?: boolean }

const tabs: { key: Tab; label: string }[] = [
  { key: 'customers', label: '客户' },
  { key: 'orders', label: '订单' },
  { key: 'vehicles', label: '车辆' },
  { key: 'drivers', label: '司机' },
]
const activeTab = ref<Tab>('customers')
const customers = ref<Customer[]>([])
const orders = ref<Order[]>([])
const vehicles = ref<Vehicle[]>([])
const drivers = ref<Driver[]>([])
const editingId = ref<number | null>(null)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const draft = reactive<Row>({})

const fields = computed<Field[]>(() => {
  if (activeTab.value === 'customers') return [
    { key: 'name', label: '客户名称', required: true }, { key: 'phone', label: '电话', required: true },
    { key: 'address', label: '地址', required: true }, { key: 'lng', label: '经度', type: 'number', step: 0.000001, required: true },
    { key: 'lat', label: '纬度', type: 'number', step: 0.000001, required: true },
    { key: 'timeWindowStart', label: '时间窗开始（分钟）', type: 'number', min: 0, required: true },
    { key: 'timeWindowEnd', label: '时间窗结束（分钟）', type: 'number', min: 0, required: true },
    { key: 'serviceTime', label: '服务时长（分钟）', type: 'number', min: 0 },
  ]
  if (activeTab.value === 'orders') return [
    { key: 'customerId', label: '客户', type: 'customer', required: true },
    { key: 'weight', label: '重量（kg）', type: 'number', min: 0, step: 0.1, required: true },
    { key: 'volume', label: '体积（m³）', type: 'number', min: 0, step: 0.01, required: true },
    { key: 'priority', label: '优先级', type: 'number', step: 1 },
  ]
  if (activeTab.value === 'vehicles') return [
    { key: 'plate', label: '车牌号', required: true },
    { key: 'capacityW', label: '载重上限（kg）', type: 'number', min: 0.01, step: 0.1, required: true },
    { key: 'capacityV', label: '容积上限（m³）', type: 'number', min: 0.01, step: 0.01, required: true },
    ...(editingId.value ? [{ key: 'status', label: '车辆状态', type: 'vehicle-status' }] : []),
  ]
  return [
    { key: 'name', label: '司机姓名', required: true }, { key: 'phone', label: '手机号', required: true },
    { key: 'license', label: '驾驶证号', required: true },
    ...(editingId.value ? [{ key: 'status', label: '司机状态', type: 'driver-status' }] : []),
  ]
})

const columns = computed(() => {
  if (activeTab.value === 'customers') return [{ key: 'name', label: '客户' }, { key: 'phone', label: '电话' }, { key: 'address', label: '地址' }, { key: 'lng', label: '经度' }, { key: 'lat', label: '纬度' }]
  if (activeTab.value === 'orders') return [{ key: 'id', label: '编号' }, { key: 'customerName', label: '客户' }, { key: 'weight', label: '重量' }, { key: 'volume', label: '体积' }, { key: 'status', label: '状态' }]
  if (activeTab.value === 'vehicles') return [{ key: 'plate', label: '车牌' }, { key: 'capacityW', label: '载重' }, { key: 'capacityV', label: '容积' }, { key: 'status', label: '状态' }]
  return [{ key: 'name', label: '司机' }, { key: 'phone', label: '电话' }, { key: 'license', label: '驾驶证号' }, { key: 'status', label: '状态' }]
})

const records = computed<Row[]>(() => {
  if (activeTab.value === 'customers') return customers.value
  if (activeTab.value === 'orders') return orders.value.map((order) => ({ ...order, customerName: order.customer?.name ?? `客户 #${order.customerId}` }))
  if (activeTab.value === 'vehicles') return vehicles.value
  return drivers.value
})

function resetDraft() {
  editingId.value = null
  Object.keys(draft).forEach((key) => delete draft[key])
  const values: Row = activeTab.value === 'customers'
    ? { name: '', phone: '', address: '', lng: 120.16, lat: 30.26, timeWindowStart: 480, timeWindowEnd: 1080, serviceTime: 10 }
    : activeTab.value === 'orders'
      ? { customerId: customers.value[0]?.id ?? '', weight: 10, volume: 0.1, priority: 0 }
      : activeTab.value === 'vehicles'
        ? { plate: '', capacityW: 200, capacityV: 5 }
        : { name: '', phone: '', license: '' }
  Object.assign(draft, values)
}

watch(activeTab, () => { error.value = ''; notice.value = ''; resetDraft() })

async function loadAll() {
  const [customerRows, orderRows, vehicleRows, driverRows] = await Promise.all([
    customersApi.findAll(), ordersApi.findAll(), vehiclesApi.findAll(), driversApi.findAll(),
  ])
  customers.value = customerRows
  orders.value = orderRows
  vehicles.value = vehicleRows
  drivers.value = driverRows
  if (activeTab.value === 'orders' && !draft.customerId && customers.value.length) draft.customerId = customers.value[0].id
}

function edit(row: Row) {
  editingId.value = row.id
  Object.keys(draft).forEach((key) => delete draft[key])
  const keys = fields.value.map((field) => field.key)
  Object.assign(draft, Object.fromEntries(keys.map((key) => [key, row[key] ?? ''])))
  error.value = ''
  notice.value = ''
}

function canEdit(row: Row) {
  if (activeTab.value === 'orders') return row.status === 'PENDING'
  if (activeTab.value === 'vehicles' || activeTab.value === 'drivers') return row.status !== 'ON_DUTY'
  return true
}

async function save() {
  error.value = ''
  notice.value = ''
  saving.value = true
  try {
    const id = editingId.value
    if (activeTab.value === 'customers') {
      const data = { ...draft } as Partial<Customer>
      if (id) await customersApi.update(id, data); else await customersApi.create(data)
    } else if (activeTab.value === 'orders') {
      const data = { ...draft } as Partial<Order>
      if (id) await ordersApi.update(id, data); else await ordersApi.create(data)
    } else if (activeTab.value === 'vehicles') {
      const data = { ...draft } as Partial<Vehicle>
      if (id) await vehiclesApi.update(id, data); else await vehiclesApi.create(data)
    } else {
      const data = { ...draft } as Partial<Driver>
      if (id) await driversApi.update(id, data); else await driversApi.create(data)
    }
    notice.value = id ? '已保存修改' : '已创建记录'
    await loadAll()
    resetDraft()
  } catch (e: any) {
    error.value = e?.response?.data?.message?.toString?.() ?? e?.message ?? '保存失败'
  } finally {
    saving.value = false
  }
}

async function remove(row: Row) {
  if (!window.confirm(`确认删除 #${row.id ?? row.plate ?? row.name}？`)) return
  error.value = ''
  notice.value = ''
  try {
    if (activeTab.value === 'customers') await customersApi.remove(row.id)
    else if (activeTab.value === 'orders') await ordersApi.remove(row.id)
    else if (activeTab.value === 'vehicles') await vehiclesApi.remove(row.id)
    else await driversApi.remove(row.id)
    notice.value = '已删除记录'
    await loadAll()
    if (editingId.value === row.id) resetDraft()
  } catch (e: any) {
    error.value = e?.response?.data?.message?.toString?.() ?? e?.message ?? '删除失败：记录可能正在被引用'
  }
}

onMounted(async () => {
  try { await loadAll(); resetDraft() }
  catch (e: any) { error.value = e?.response?.data?.message?.toString?.() ?? e?.message ?? '数据加载失败' }
})
</script>

<template>
  <div class="data-page">
    <header class="page-heading">
      <div><h1>基础数据</h1><p>维护客户、订单、车辆和司机；正在执行的订单与资源请通过任务状态流转管理。</p></div>
      <button class="secondary" @click="loadAll">刷新数据</button>
    </header>
    <nav class="tabs" aria-label="基础数据类别">
      <button v-for="tab in tabs" :key="tab.key" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">{{ tab.label }}</button>
    </nav>
    <div class="content-grid">
      <section class="card editor">
        <h2>{{ editingId ? '编辑记录' : `新增${tabs.find((tab) => tab.key === activeTab)?.label}` }}</h2>
        <form @submit.prevent="save">
          <label v-for="field in fields" :key="field.key">
            <span>{{ field.label }}</span>
            <select v-if="field.type === 'customer'" v-model.number="draft[field.key]" required>
              <option disabled value="">请选择客户</option>
              <option v-for="customer in customers" :key="customer.id" :value="customer.id">#{{ customer.id }} {{ customer.name }}</option>
            </select>
            <select v-else-if="field.type === 'vehicle-status'" v-model="draft[field.key]"><option value="IDLE">空闲</option><option value="MAINTENANCE">维修</option></select>
            <select v-else-if="field.type === 'driver-status'" v-model="draft[field.key]"><option value="AVAILABLE">可用</option><option value="OFF">休息</option></select>
            <input v-else v-model="draft[field.key]" :type="field.type ?? 'text'" :min="field.min" :step="field.step" :required="field.required" />
          </label>
          <p v-if="activeTab === 'orders' && !customers.length" class="muted">请先创建客户，再录入订单。</p>
          <div class="form-actions">
            <button class="primary" type="submit" :disabled="saving || (activeTab === 'orders' && !customers.length)">{{ saving ? '保存中…' : '保存' }}</button>
            <button v-if="editingId" class="secondary" type="button" @click="resetDraft">取消编辑</button>
          </div>
        </form>
        <p v-if="notice" class="notice">{{ notice }}</p>
        <p v-if="error" class="error">{{ error }}</p>
      </section>
      <section class="card table-card">
        <div class="table-heading"><h2>{{ tabs.find((tab) => tab.key === activeTab)?.label }}列表</h2><span>{{ records.length }} 条</span></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th v-for="column in columns" :key="column.key">{{ column.label }}</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="row in records" :key="row.id">
                <td v-for="column in columns" :key="column.key">{{ formatCell(row, column.key) }}</td>
                <td class="actions">
                  <button v-if="canEdit(row)" @click="edit(row)">编辑</button>
                  <span v-else class="locked">已进入配送流程</span>
                  <button class="danger" @click="remove(row)">删除</button>
                </td>
              </tr>
              <tr v-if="!records.length"><td :colspan="columns.length + 1" class="empty">暂无记录</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.data-page { display: flex; flex-direction: column; gap: 20px; }
.page-heading, .table-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.page-heading h1 { margin: 0; color: var(--c-primary-strong); font-size: 24px; font-weight: 600; }
.page-heading p { margin: 8px 0 0; color: var(--c-text-2); font-size: 14px; }
.tabs { display: flex; gap: 6px; }
.tabs button, .secondary, .actions button {
  border: 1px solid var(--c-line); background: var(--c-card); color: var(--c-text-2);
  border-radius: 8px; padding: 9px 16px; cursor: pointer; font-size: 14px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.tabs button:hover { border-color: var(--c-accent); color: var(--c-primary); }
.tabs button.active, .primary { background: var(--c-primary); border-color: var(--c-primary); color: #fff; }
.tabs button.active { font-weight: 600; }
.content-grid { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); gap: 20px; align-items: start; }
.card { background: var(--c-card); border-radius: var(--radius); padding: 22px; box-shadow: var(--shadow); }
.card h2 { font-size: 16px; margin: 0 0 16px; color: var(--c-text); font-weight: 600; }
.editor form { display: grid; gap: 12px; }
.editor label { display: grid; gap: 6px; font-size: 13px; color: var(--c-text-2); }
.editor input, .editor select {
  padding: 9px 11px; border: 1px solid var(--c-line); border-radius: 8px;
  font: inherit; font-size: 14px; color: var(--c-text); background: var(--c-card);
}
.editor input:focus, .editor select:focus {
  outline: none; border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-soft);
}
.form-actions { display: flex; gap: 10px; margin-top: 6px; }
.form-actions button { border-radius: 8px; padding: 10px 18px; cursor: pointer; font-size: 14px; }
.primary:hover:not(:disabled) { background: var(--c-primary-strong); }
.primary:disabled { opacity: 0.55; cursor: wait; }
.notice, .error, .muted { font-size: 13px; margin: 14px 0 0; }
.notice { color: var(--c-success); }
.error { color: var(--c-danger); white-space: pre-wrap; }
.muted { color: var(--c-text-3); }
.table-heading span { font-size: 13px; color: var(--c-text-3); }
.table-scroll { overflow: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
th, td { border-bottom: 1px solid var(--c-line); padding: 11px 10px; text-align: left; white-space: nowrap; }
th { color: var(--c-text-2); background: #f8fafc; font-weight: 600; font-size: 12.5px; }
tbody tr:hover { background: #f7fafc; }
.actions { display: flex; gap: 8px; align-items: center; }
.actions button { padding: 6px 12px; font-size: 13px; }
.actions button:hover { border-color: var(--c-accent); color: var(--c-primary); }
.actions .danger { color: var(--c-danger); }
.actions .danger:hover { border-color: var(--c-danger); color: var(--c-danger); }
.locked { color: var(--c-text-3); font-size: 12.5px; }
.empty { text-align: center; color: var(--c-text-3); padding: 36px; }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .page-heading { align-items: flex-start; } .tabs { overflow: auto; } .card { padding: 16px; } }
</style>
