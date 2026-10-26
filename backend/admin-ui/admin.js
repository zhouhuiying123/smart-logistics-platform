(() => {
  'use strict'

  const API = {
    customers: '/customers',
    orders: '/orders',
    vehicles: '/vehicles',
    drivers: '/drivers',
    tasks: '/dispatch-tasks',
  }
  const TITLES = {
    overview: ['运营总览', '实时掌握订单履约与车辆运力，快速处理待办事项。'],
    orders: ['订单管理', '查看订单状态；仅待分配订单可编辑，配送状态由调度任务流转。'],
    customers: ['客户资料', '维护配送客户、地址坐标与服务时间窗。'],
    vehicles: ['车辆管理', '维护运力信息；执行中的车辆状态由调度任务自动管理。'],
    drivers: ['司机管理', '维护司机档案与可用状态；执勤状态由调度任务自动管理。'],
    tasks: ['调度任务', '跟进任务状态与关联资源；任务由路线优化确认流程创建。'],
  }
  const STATUS = {
    PENDING: ['待分配', 'status-neutral'], ASSIGNED: ['已分配', 'status-blue'],
    IN_TRANSIT: ['配送中', 'status-amber'], DELIVERED: ['已送达', 'status-green'],
    FAILED: ['失败', 'status-red'], CANCELLED: ['已取消', 'status-neutral'],
    CREATED: ['待确认', 'status-neutral'], STARTED: ['执行中', 'status-amber'],
    COMPLETED: ['已完成', 'status-green'], IDLE: ['空闲', 'status-green'],
    ON_DUTY: ['执行中', 'status-blue'], MAINTENANCE: ['维修中', 'status-red'],
    AVAILABLE: ['可用', 'status-green'], OFF: ['休息', 'status-neutral'],
  }
  const VIEWS = {
    orders: { endpoint: 'orders', label: '订单', singular: '订单', search: ['id', 'customer.name', 'status'], create: true },
    customers: { endpoint: 'customers', label: '客户', singular: '客户', search: ['name', 'phone', 'address'], create: true },
    vehicles: { endpoint: 'vehicles', label: '车辆', singular: '车辆', search: ['plate', 'status'], create: true },
    drivers: { endpoint: 'drivers', label: '司机', singular: '司机', search: ['name', 'phone', 'license'], create: true },
    tasks: { endpoint: 'tasks', label: '任务', singular: '任务', search: ['id', 'vehicle.plate', 'driver.name', 'status'], create: false },
  }

  const state = { data: {}, view: 'overview', search: '', status: 'ALL', page: 1, pageSize: 8, loading: false, mutation: false, pendingAction: null }
  const el = (id) => document.getElementById(id)
  const $page = el('pageBody')
  const $formDialog = el('recordDialog')
  const $form = el('recordForm')
  const $confirmDialog = el('confirmDialog')
  const $toast = el('toastRegion')

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
  }
  function getPath(obj, path) { return path.split('.').reduce((value, key) => value?.[key], obj) }
  function fmt(value, digits = 0) {
    const number = Number(value)
    return Number.isFinite(number) ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(number) : '—'
  }
  function fmtDate(value, withTime = false) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('zh-CN', withTime ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } : { month: '2-digit', day: '2-digit' }).format(date)
  }
  function timeNow() {
    const now = new Date()
    el('clock').textContent = new Intl.DateTimeFormat('zh-CN', { weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
    el('dateChip').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now)
  }
  function statusBadge(status) {
    const [label, cls] = STATUS[status] || [status || '未知', 'status-neutral']
    return `<span class="status-badge ${cls}">${escapeHTML(label)}</span>`
  }
  async function request(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } })
    const text = await response.text()
    let payload = null
    if (text) { try { payload = JSON.parse(text) } catch { payload = text } }
    if (!response.ok) {
      const message = payload?.message
      throw new Error(Array.isArray(message) ? message.join('；') : message || `请求失败（${response.status}）`)
    }
    return payload
  }
  async function loadData({ quiet = false } = {}) {
    if (state.loading) return
    state.loading = true
    if (!quiet) $page.setAttribute('aria-busy', 'true')
    try {
      const entries = Object.entries(API)
      const values = await Promise.all(entries.map(([, endpoint]) => request(endpoint)))
      entries.forEach(([key], index) => { state.data[key] = Array.isArray(values[index]) ? values[index] : [] })
      el('apiHealth').className = 'api-health online'
      el('apiHealth').innerHTML = '<i></i>业务接口正常'
      el('pendingNav').textContent = fmt(state.data.orders.filter((item) => item.status === 'PENDING').length)
      render()
    } catch (error) {
      el('apiHealth').className = 'api-health offline'
      el('apiHealth').innerHTML = '<i></i>接口连接异常'
      if (!quiet) renderError(error)
      else toast(error.message || '刷新失败，请检查后端服务。', 'error')
    } finally {
      state.loading = false
      $page.setAttribute('aria-busy', 'false')
    }
  }
  function renderError(error) {
    $page.innerHTML = `<section class="state-panel" role="alert"><strong>暂时无法读取业务数据</strong><p>${escapeHTML(error.message || '请确认数据库和 NestJS 后端服务正在运行。')}<br />后台页面连接同源 REST API，请确认服务地址与数据表状态。</p><button class="button button-primary" type="button" data-action="retry">重新连接</button></section>`
  }
  function toast(message, type = 'success') {
    const item = document.createElement('div')
    item.className = 'toast'
    item.style.setProperty('--toast-color', type === 'error' ? 'var(--red)' : type === 'warning' ? 'var(--amber)' : 'var(--accent)')
    item.textContent = message
    $toast.append(item)
    window.setTimeout(() => item.remove(), 4200)
  }
  function changeView(view) {
    if (view !== 'overview' && !VIEWS[view]) return
    state.view = view
    state.search = ''
    state.status = 'ALL'
    state.page = 1
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view))
    const [title, subtitle] = TITLES[view]
    el('pageTitle').textContent = title
    el('crumbTitle').textContent = title
    el('pageSubtitle').textContent = subtitle
    el('createButton').hidden = !VIEWS[view]?.create
    render()
    el('mainContent').focus({ preventScroll: true })
  }
  function render() {
    if (state.view === 'overview') renderOverview()
    else renderTable(state.view)
  }
  function countBy(items, key) { return items.reduce((counts, item) => { counts[item[key] || 'UNKNOWN'] = (counts[item[key] || 'UNKNOWN'] || 0) + 1; return counts }, {}) }
  function metricCard(label, value, note, icon, color, trend = '') {
    return `<article class="kpi-card" style="--metric-color:${color}"><div class="kpi-top"><span>${label}</span><span class="kpi-icon" aria-hidden="true">${icon}</span></div><div class="kpi-value">${value}</div><div class="kpi-foot"><span>${note}</span>${trend ? `<span class="${trend.includes('待') ? 'metric-warn' : 'metric-good'}">${trend}</span>` : ''}</div></article>`
  }
  function lastSevenDaysOrders() {
    const now = new Date()
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(now)
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - (6 - index))
      return { date: day, label: `${day.getMonth() + 1}/${day.getDate()}`, count: 0 }
    })
    const byKey = new Map(days.map((day) => [`${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`, day]))
    for (const order of state.data.orders) {
      const date = new Date(order.createdAt)
      if (Number.isNaN(date.getTime())) continue
      const bucket = byKey.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`)
      if (bucket) bucket.count += 1
    }
    return days
  }
  function lineChart(days) {
    const width = 620, height = 190, left = 31, right = 10, top = 12, bottom = 25
    const innerW = width - left - right, innerH = height - top - bottom
    const max = Math.max(1, ...days.map((item) => item.count))
    const points = days.map((item, index) => ({ x: left + index * innerW / Math.max(1, days.length - 1), y: top + innerH - item.count / max * innerH, ...item }))
    const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const area = `${path} L ${points.at(-1)?.x ?? left} ${top + innerH} L ${points[0]?.x ?? left} ${top + innerH} Z`
    const grid = [0, 1, 2, 3].map((i) => {
      const y = top + innerH * i / 3
      const value = fmt(Math.ceil(max * (3 - i) / 3))
      return `<line class="chart-gridline" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/><text class="chart-label" x="${left - 8}" y="${y + 3}" text-anchor="end">${value}</text>`
    }).join('')
    const dots = points.map((p) => `<circle class="chart-point" cx="${p.x}" cy="${p.y}" r="3.2"><title>${escapeHTML(p.label)}：${p.count} 单</title></circle><text class="chart-label" x="${p.x}" y="${height - 5}" text-anchor="middle">${escapeHTML(p.label)}</text>`).join('')
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="近七日新建订单趋势"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#39d7d0" stop-opacity=".23"/><stop offset="100%" stop-color="#39d7d0" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${dots}</svg>`
  }
  function renderOverview() {
    const orders = state.data.orders || []
    const vehicles = state.data.vehicles || []
    const drivers = state.data.drivers || []
    const tasks = state.data.tasks || []
    const customers = state.data.customers || []
    const pending = orders.filter((o) => o.status === 'PENDING').length
    const transit = orders.filter((o) => o.status === 'IN_TRANSIT').length
    const delivered = orders.filter((o) => o.status === 'DELIVERED').length
    const busyVehicles = vehicles.filter((v) => v.status === 'ON_DUTY').length
    const fleetRate = vehicles.length ? Math.round(busyVehicles / vehicles.length * 100) : 0
    const activeTasks = tasks.filter((t) => ['ASSIGNED', 'STARTED'].includes(t.status)).length
    const taskOrder = [...tasks].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5)
    const recentOrders = [...orders].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6)
    const taskCounts = countBy(tasks, 'status')
    const taskStatuses = [
      ['待确认', taskCounts.CREATED || 0, '#91a6ae'], ['已分配', taskCounts.ASSIGNED || 0, '#62aaff'],
      ['执行中', taskCounts.STARTED || 0, '#f0b34f'], ['已完成', taskCounts.COMPLETED || 0, '#57d6a3'],
      ['已取消', taskCounts.CANCELLED || 0, '#71848a'],
    ]
    const taskMax = Math.max(1, ...taskStatuses.map((item) => item[1]))
    const fleetStates = [
      ['空闲车辆', vehicles.filter((v) => v.status === 'IDLE').length, '#57d6a3'],
      ['执行任务', busyVehicles, '#62aaff'],
      ['维修车辆', vehicles.filter((v) => v.status === 'MAINTENANCE').length, '#f07a7a'],
    ]
    const driversFree = drivers.filter((d) => d.status === 'AVAILABLE').length
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayOrders = orders.filter((o) => { const d = new Date(o.createdAt); return !Number.isNaN(d.getTime()) && d >= today }).length
    $page.innerHTML = `
      <section class="kpi-grid" aria-label="核心业务指标">
        ${metricCard('累计订单', fmt(orders.length), `${fmt(todayOrders)} 单今日新建`, '▤', '#39d7d0')}
        ${metricCard('待分配订单', fmt(pending), '需要安排配送资源', '◷', '#f0b34f', pending ? `${fmt(pending)} 单待处理` : '')}
        ${metricCard('配送中订单', fmt(transit), '当前正在履约', '⇢', '#62aaff')}
        ${metricCard('订单送达率', `${orders.length ? fmt(delivered / orders.length * 100) : '0'}%`, `${fmt(delivered)} 单已送达`, '✓', '#57d6a3')}
      </section>
      <section class="section-grid">
        <article class="panel"><header class="panel-header"><div><h2 class="panel-title">订单创建趋势</h2><p class="panel-note">按订单创建日期统计 · 最近七天</p></div><span class="status-badge status-cyan">${fmt(orders.length)} 单累计</span></header><div class="chart-wrap">${lineChart(lastSevenDaysOrders())}</div></article>
        <article class="panel"><header class="panel-header"><div><h2 class="panel-title">调度任务进度</h2><p class="panel-note">任务状态实时汇总 · ${fmt(tasks.length)} 个任务</p></div><button class="panel-action" type="button" data-goto="tasks">查看任务 →</button></header><div class="status-list">${taskStatuses.map(([label, count, color]) => `<div class="status-row"><span>${label}</span><div class="status-track" aria-label="${label} ${count} 个"><div class="status-fill" style="--bar-color:${color};width:${Math.round(Number(count) / taskMax * 100)}%"></div></div><strong class="status-number">${fmt(count)}</strong></div>`).join('')}</div></article>
      </section>
      <section class="section-grid equal">
        <article class="panel"><header class="panel-header"><div><h2 class="panel-title">车辆运力</h2><p class="panel-note">${vehicles.length ? `当前运力使用率 ${fleetRate}%` : '尚未录入车辆'}</p></div><button class="panel-action" type="button" data-goto="vehicles">车辆管理 →</button></header><div class="fleet-grid">${fleetStates.map(([label, count, color]) => `<div class="fleet-state" style="--metric-color:${color}"><strong class="fleet-count">${fmt(count)}</strong><span class="fleet-label">${label}</span></div>`).join('')}</div><div class="status-list" style="padding-top:0"><div class="status-row"><span>可用司机</span><div class="status-track" aria-label="可用司机 ${driversFree} 人"><div class="status-fill" style="--bar-color:#57d6a3;width:${drivers.length ? Math.round(driversFree / drivers.length * 100) : 0}%"></div></div><strong class="status-number">${fmt(driversFree)}</strong></div><div class="status-row"><span>客户档案</span><span style="grid-column:span 2;text-align:right;color:#dce8ea">${fmt(customers.length)} 个客户</span></div></div></article>
        <article class="panel"><header class="panel-header"><div><h2 class="panel-title">近期调度任务</h2><p class="panel-note">按任务编号倒序 · 仅展示最近五条</p></div><button class="panel-action" type="button" data-goto="tasks">全部任务 →</button></header>${taskOrder.length ? `<div class="table-wrap"><table><thead><tr><th>任务编号</th><th>车辆 / 司机</th><th>状态</th><th class="numeric">停靠点</th></tr></thead><tbody>${taskOrder.map((task) => `<tr><td class="primary-cell">#${fmt(task.id)}</td><td>${escapeHTML(task.vehicle?.plate || '—')}<span class="secondary-cell">${escapeHTML(task.driver?.name || '—')}</span></td><td>${statusBadge(task.status)}</td><td class="numeric">${fmt(task.stops?.length || 0)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-hero"><strong>暂无调度任务</strong><p>路线优化并确认方案后，调度任务会显示在这里。</p></div>`}</article>
      </section>
      <article class="panel recent-panel"><header class="panel-header"><div><h2 class="panel-title">最近订单</h2><p class="panel-note">订单状态由调度任务流程更新</p></div><button class="panel-action" type="button" data-goto="orders">订单管理 →</button></header>${recentOrders.length ? `<div class="table-wrap"><table><thead><tr><th>订单编号</th><th>配送客户</th><th>货物重量</th><th>体积</th><th>状态</th><th>创建时间</th></tr></thead><tbody>${recentOrders.map((order) => `<tr><td class="primary-cell">#${fmt(order.id)}</td><td>${escapeHTML(order.customer?.name || `客户 ${order.customerId}`)}<span class="secondary-cell">${escapeHTML(order.customer?.address || '')}</span></td><td class="numeric">${fmt(order.weight, 1)} kg</td><td class="numeric">${fmt(order.volume, 2)} m³</td><td>${statusBadge(order.status)}</td><td>${fmtDate(order.createdAt, true)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-hero"><strong>暂无订单</strong><p>订单创建后会在这里显示。</p></div>`}</article>
    `
  }

  function orderActions(item) {
    const canEdit = item.status === 'PENDING'
    return `<div class="table-actions">${canEdit ? `<button class="button button-quiet button-small" type="button" data-action="edit" data-id="${item.id}">编辑</button>` : ''}<button class="button button-quiet button-small" type="button" data-action="delete" data-id="${item.id}" ${canEdit ? '' : 'disabled title="有调度记录的订单不可删除"'}>删除</button></div>`
  }
  function recordColumns(view, item) {
    if (view === 'orders') return `<td class="primary-cell">#${fmt(item.id)}</td><td>${escapeHTML(item.customer?.name || `客户 ${item.customerId}`)}<span class="secondary-cell">${escapeHTML(item.customer?.address || '')}</span></td><td class="numeric">${fmt(item.weight, 1)} kg</td><td class="numeric">${fmt(item.volume, 2)} m³</td><td>${fmt(item.priority)}</td><td>${statusBadge(item.status)}</td><td>${fmtDate(item.createdAt, true)}</td><td>${orderActions(item)}</td>`
    if (view === 'customers') return `<td class="primary-cell">${escapeHTML(item.name)}</td><td>${escapeHTML(item.phone)}</td><td>${escapeHTML(item.address)}</td><td>${fmt(item.lng, 5)}, ${fmt(item.lat, 5)}</td><td>${minuteTime(item.timeWindowStart)}–${minuteTime(item.timeWindowEnd)}<span class="secondary-cell">服务 ${fmt(item.serviceTime)} 分钟</span></td><td><div class="table-actions"><button class="button button-quiet button-small" type="button" data-action="edit" data-id="${item.id}">编辑</button><button class="button button-quiet button-small" type="button" data-action="delete" data-id="${item.id}">删除</button></div></td>`
    if (view === 'vehicles') return `<td class="primary-cell">${escapeHTML(item.plate)}</td><td class="numeric">${fmt(item.capacityW, 1)} kg</td><td class="numeric">${fmt(item.capacityV, 2)} m³</td><td>${statusBadge(item.status)}</td><td><div class="table-actions"><button class="button button-quiet button-small" type="button" data-action="edit" data-id="${item.id}">编辑</button><button class="button button-quiet button-small" type="button" data-action="delete" data-id="${item.id}">删除</button></div></td>`
    if (view === 'drivers') return `<td class="primary-cell">${escapeHTML(item.name)}</td><td>${escapeHTML(item.phone)}</td><td>${escapeHTML(item.license)}</td><td>${statusBadge(item.status)}</td><td><div class="table-actions"><button class="button button-quiet button-small" type="button" data-action="edit" data-id="${item.id}">编辑</button><button class="button button-quiet button-small" type="button" data-action="delete" data-id="${item.id}">删除</button></div></td>`
    const stops = item.stops || []
    const next = taskNextAction(item)
    return `<td class="primary-cell">#${fmt(item.id)}<span class="secondary-cell">${fmtDate(item.createdAt, true)}</span></td><td>${escapeHTML(item.vehicle?.plate || '—')}<span class="secondary-cell">${escapeHTML(item.driver?.name || '—')}</span></td><td>${statusBadge(item.status)}</td><td>${stops.length} 个<span class="secondary-cell">${escapeHTML(stops.slice(0, 2).map((stop) => stop.order?.customer?.name || `订单${stop.orderId}`).join('、'))}${stops.length > 2 ? '…' : ''}</span></td><td class="numeric">${Number(item.totalDist) ? `${fmt(Number(item.totalDist) / 1000, 1)} km` : '—'}</td><td>${next ? `<button class="button button-primary button-small" type="button" data-action="transition" data-id="${item.id}" data-next="${next.status}">${next.label}</button>` : '<span class="secondary-cell">—</span>'}<button class="button button-quiet button-small" style="margin-left:5px" type="button" data-action="delete" data-id="${item.id}" ${['ASSIGNED', 'STARTED'].includes(item.status) ? 'disabled title="活动任务请先取消"' : ''}>删除</button></td>`
  }
  function minuteTime(value) {
    const n = Number(value)
    return Number.isFinite(n) ? `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}` : '—'
  }
  function taskNextAction(task) {
    const next = { CREATED: ['ASSIGNED', '分配任务'], ASSIGNED: ['STARTED', '开始配送'], STARTED: ['COMPLETED', '完成任务'] }[task.status]
    if (!next) return null
    return { status: next[0], label: next[1] }
  }
  function matchesSearch(item, fields, query) {
    if (!query) return true
    const value = fields.map((field) => getPath(item, field)).filter((v) => v != null).join(' ').toLocaleLowerCase('zh-CN')
    return value.includes(query.toLocaleLowerCase('zh-CN'))
  }
  function statusOptions(view) {
    const statuses = [...new Set((state.data[VIEWS[view].endpoint] || []).map((item) => item.status).filter(Boolean))]
    return statuses
  }
  function renderTable(view) {
    const config = VIEWS[view]
    const all = state.data[config.endpoint] || []
    const filtered = all.filter((item) => (state.status === 'ALL' || item.status === state.status) && matchesSearch(item, config.search, state.search))
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize))
    state.page = Math.min(state.page, pages)
    const rows = filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)
    const headers = {
      orders: '<th>订单编号</th><th>客户与地址</th><th class="numeric">重量</th><th class="numeric">体积</th><th>优先级</th><th>订单状态</th><th>创建时间</th><th>操作</th>',
      customers: '<th>客户姓名</th><th>联系电话</th><th>配送地址</th><th>经纬度</th><th>服务时间窗</th><th>操作</th>',
      vehicles: '<th>车牌号</th><th class="numeric">载重上限</th><th class="numeric">容积上限</th><th>车辆状态</th><th>操作</th>',
      drivers: '<th>司机姓名</th><th>联系电话</th><th>驾驶证号</th><th>司机状态</th><th>操作</th>',
      tasks: '<th>任务编号</th><th>车辆 / 司机</th><th>任务状态</th><th>配送停靠点</th><th class="numeric">路线距离</th><th>任务操作</th>',
    }[view]
    const statusFilter = ['orders', 'vehicles', 'drivers', 'tasks'].includes(view)
    const dataMarkup = rows.length ? rows.map((item) => `<tr>${recordColumns(view, item)}</tr>`).join('') : `<tr><td class="empty-cell" colspan="${view === 'customers' ? 6 : view === 'vehicles' || view === 'drivers' ? 5 : 8}">${all.length ? '没有符合条件的记录，试试清除搜索或筛选条件。' : `暂无${config.label}数据。`}</td></tr>`
    $page.innerHTML = `
      ${view === 'tasks' ? '<div class="route-note">任务由地图页路线优化确认后创建。此处可按后端规则推进状态；涉及车辆、司机、订单的联动由服务端执行。</div>' : ''}
      <section class="panel page-stack" aria-label="${config.label}列表">
        <div class="table-toolbar"><div class="toolbar-left"><label class="search-box"><span aria-hidden="true">⌕</span><input id="tableSearch" type="search" name="q" autocomplete="off" aria-label="搜索${config.label}" placeholder="搜索${config.label}名称、编号或信息" value="${escapeHTML(state.search)}" /><button class="search-clear" id="clearSearch" type="button" aria-label="清空搜索" ${state.search ? '' : 'hidden'}>×</button></label>${statusFilter ? `<label class="sr-only" for="statusFilter">按状态筛选</label><select id="statusFilter" class="filter-select"><option value="ALL">全部状态</option>${statusOptions(view).map((s) => `<option value="${escapeHTML(s)}" ${state.status === s ? 'selected' : ''}>${escapeHTML(STATUS[s]?.[0] || s)}</option>`).join('')}</select>` : ''}</div><div class="toolbar-right"><span class="result-count">共 ${fmt(filtered.length)} 条</span><button class="button button-quiet button-small" type="button" data-action="reload">刷新</button></div></div>
        <div class="table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${dataMarkup}</tbody></table></div>
        <div class="pagination"><span>第 ${fmt(state.page)} / ${fmt(pages)} 页 · 每页 ${fmt(state.pageSize)} 条</span><div class="pagination-controls"><button type="button" data-action="page" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''} aria-label="上一页">‹</button><button type="button" data-action="page" data-page="${state.page + 1}" ${state.page >= pages ? 'disabled' : ''} aria-label="下一页">›</button></div></div>
      </section>`
    const search = el('tableSearch')
    search?.addEventListener('input', (event) => { state.search = event.target.value; state.page = 1; const at = search.selectionStart; renderTable(view); const next = el('tableSearch'); next.focus(); next.setSelectionRange(at, at); el('clearSearch').hidden = !state.search })
    el('clearSearch')?.addEventListener('click', () => { state.search = ''; state.page = 1; renderTable(view); el('tableSearch').focus() })
    el('statusFilter')?.addEventListener('change', (event) => { state.status = event.target.value; state.page = 1; renderTable(view) })
  }

  const FORM_FIELDS = {
    customers: [
      ['name', '客户姓名', 'text', true, ''], ['phone', '联系电话', 'tel', true, ''],
      ['address', '配送地址', 'text', true, '杭州市…'], ['lng', '经度', 'number', true, '120.1551'],
      ['lat', '纬度', 'number', true, '30.2741'], ['timeWindowStart', '可接收时间 · 起始分钟', 'number', true, '540'],
      ['timeWindowEnd', '可接收时间 · 结束分钟', 'number', true, '1080'], ['serviceTime', '服务时长 · 分钟', 'number', false, '15'],
    ],
    vehicles: [['plate', '车牌号', 'text', true, '浙A…'], ['capacityW', '载重上限 · kg', 'number', true, '1000'], ['capacityV', '容积上限 · m³', 'number', true, '6']],
    drivers: [['name', '司机姓名', 'text', true, ''], ['phone', '联系电话', 'tel', true, '1xxxxxxxxxx'], ['license', '驾驶证号', 'text', true, '']],
    orders: [['customerId', '配送客户', 'customer', true, ''], ['weight', '货物重量 · kg', 'number', true, '0'], ['volume', '货物体积 · m³', 'number', true, '0'], ['priority', '优先级 · 数值越大越优先', 'number', false, '0']],
  }
  function addField([name, label, type, required, placeholder], value, edit = false) {
    const id = `field-${name}`
    const full = name === 'address' || name === 'customerId' ? ' full' : ''
    const step = ['lng', 'lat'].includes(name) ? 'any' : ['capacityW', 'capacityV', 'weight', 'volume'].includes(name) ? '0.01' : '1'
    const bounds = name === 'lng' ? 'min="-180" max="180"' : name === 'lat' ? 'min="-90" max="90"' : name.startsWith('timeWindow') ? 'min="0" max="1440"' : ['capacityW', 'capacityV'].includes(name) ? 'min="0.01"' : 'min="0"'
    const attrs = `id="${id}" name="${name}" ${required ? 'required' : ''} ${type === 'number' ? `type="number" step="${step}" ${bounds}` : `type="${type === 'customer' ? 'text' : type}"`}`
    if (type === 'customer') {
      const options = (state.data.customers || []).map((customer) => `<option value="${customer.id}" ${Number(value) === Number(customer.id) ? 'selected' : ''}>${escapeHTML(customer.name)} · ${escapeHTML(customer.address)}</option>`).join('')
      return `<div class="field${full}"><label for="${id}">${label}${required ? ' *' : ''}</label><select id="${id}" name="${name}" ${required ? 'required' : ''}><option value="">请选择客户</option>${options}</select>${!(state.data.customers || []).length ? '<span class="field-hint">请先创建客户，再录入订单。</span>' : ''}</div>`
    }
    if (name === 'status') return `<div class="field"><label for="${id}">${label}</label><select id="${id}" name="${name}">${value}</select></div>`
    if (name === 'vehicleStatus') return `<div class="field"><label for="${id}">${label}</label><select id="${id}" name="status"><option value="IDLE" ${value === 'IDLE' ? 'selected' : ''}>空闲</option><option value="MAINTENANCE" ${value === 'MAINTENANCE' ? 'selected' : ''}>维修中</option></select><span class="field-hint">执行任务中的车辆状态由调度任务管理。</span></div>`
    if (name === 'driverStatus') return `<div class="field"><label for="${id}">${label}</label><select id="${id}" name="status"><option value="AVAILABLE" ${value === 'AVAILABLE' ? 'selected' : ''}>可用</option><option value="OFF" ${value === 'OFF' ? 'selected' : ''}>休息</option></select><span class="field-hint">执勤中的司机状态由调度任务管理。</span></div>`
    const hint = name.startsWith('timeWindow') ? '<span class="field-hint">使用 0–1440 分钟表示当天时间，例如 09:00 = 540。</span>' : ''
    return `<div class="field${full}"><label for="${id}">${label}${required ? ' *' : ''}</label><input ${attrs} value="${escapeHTML(value ?? '')}" placeholder="${escapeHTML(placeholder)}" ${edit && name === 'id' ? 'readonly' : ''} />${hint}</div>`
  }
  function openForm(view, item = null) {
    const fields = [...FORM_FIELDS[view]]
    if (item && view === 'vehicles') fields.push(['vehicleStatus', '车辆状态', 'select', false, ''])
    if (item && view === 'drivers') fields.push(['driverStatus', '司机状态', 'select', false, ''])
    el('dialogTitle').textContent = `${item ? '编辑' : '新增'}${VIEWS[view].singular}`
    el('formError').hidden = true
    el('saveButton').textContent = item ? '保存修改' : '创建记录'
    el('formFields').innerHTML = fields.map((field) => addField(field, item?.[field[0]] ?? (field[0] === 'serviceTime' ? 15 : field[0] === 'timeWindowStart' ? 540 : field[0] === 'timeWindowEnd' ? 1080 : field[0] === 'priority' ? 0 : ''))).join('')
    $form.dataset.view = view
    $form.dataset.id = item?.id ?? ''
    $formDialog.showModal()
    $formDialog.querySelector('input,select')?.focus()
  }
  function showConfirm({ title, message, actionLabel = '确认', destructive = false, onConfirm }) {
    el('confirmTitle').textContent = title
    el('confirmMessage').textContent = message
    const button = el('confirmDeleteButton')
    button.textContent = actionLabel
    button.className = `button ${destructive ? 'button-danger' : 'button-primary'}`
    state.pendingAction = onConfirm
    $confirmDialog.showModal()
    button.focus()
  }
  async function submitForm(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity() || state.mutation) return
    const view = form.dataset.view
    const id = form.dataset.id
    const formData = new FormData(form)
    const body = Object.fromEntries(formData.entries())
    for (const [key, value] of Object.entries(body)) {
      const input = form.elements.namedItem(key)
      if (input instanceof HTMLInputElement && input.type === 'number') body[key] = Number(value)
    }
    if (view === 'orders' && body.customerId) body.customerId = Number(body.customerId)
    if (view === 'customers' && !id) body.serviceTime = Number(body.serviceTime || 0)
    const button = el('saveButton')
    button.disabled = true
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span> 正在保存'
    el('formError').hidden = true
    state.mutation = true
    try {
      await request(`${API[VIEWS[view].endpoint]}${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      $formDialog.close()
      toast(id ? '修改已保存' : '记录已创建')
      await loadData({ quiet: true })
      changeView(view)
    } catch (error) {
      el('formError').textContent = error.message || '保存失败，请检查输入后重试。'
      el('formError').hidden = false
      button.focus()
    } finally {
      state.mutation = false
      button.disabled = false
      button.textContent = id ? '保存修改' : '创建记录'
    }
  }
  async function deleteRecord(view, id) {
    const config = VIEWS[view]
    showConfirm({
      title: `删除这条${config.singular}？`,
      message: '删除后无法恢复。若这条记录仍被订单或调度任务引用，后端会阻止删除并说明原因。',
      actionLabel: '确认删除', destructive: true,
      onConfirm: async () => {
        el('confirmDeleteButton').disabled = true
        try {
          await request(`${API[config.endpoint]}/${id}`, { method: 'DELETE' })
          $confirmDialog.close()
          toast(`${config.singular}已删除`)
          await loadData({ quiet: true })
          renderTable(view)
        } catch (error) {
          $confirmDialog.close()
          toast(error.message || '删除失败，请刷新后重试。', 'error')
        } finally { el('confirmDeleteButton').disabled = false }
      },
    })
  }
  function transitionTask(id, next) {
    const label = STATUS[next]?.[0] || next
    showConfirm({
      title: `确认将任务更新为“${label}”？`,
      message: '此操作会由后端同步更新关联订单、车辆和司机状态，请确认操作对象与当前调度安排一致。',
      actionLabel: `确认${label}`,
      onConfirm: async () => {
        el('confirmDeleteButton').disabled = true
        try {
          await request(`${API.tasks}/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
          $confirmDialog.close()
          toast(`任务状态已更新：${label}`)
          await loadData({ quiet: true })
          renderTable('tasks')
        } catch (error) {
          $confirmDialog.close()
          toast(error.message || '状态更新失败，请刷新后重试。', 'error')
        } finally { el('confirmDeleteButton').disabled = false }
      },
    })
  }
  function recordFor(view, id) { return (state.data[VIEWS[view].endpoint] || []).find((item) => Number(item.id) === Number(id)) }
  function handleClick(event) {
    const nav = event.target.closest('[data-view]')
    if (nav) { changeView(nav.dataset.view); return }
    const goto = event.target.closest('[data-goto]')
    if (goto) { changeView(goto.dataset.goto); return }
    const control = event.target.closest('[data-action]')
    if (!control) return
    const action = control.dataset.action
    if (action === 'retry' || action === 'reload') { loadData(); return }
    if (action === 'page') { state.page = Number(control.dataset.page); renderTable(state.view); return }
    if (action === 'edit') {
      const record = recordFor(state.view, control.dataset.id)
      if (record) {
        if (state.view === 'orders' && record.status !== 'PENDING') return toast('只有待分配订单可以编辑。', 'warning')
        openForm(state.view, record)
      }
      return
    }
    if (action === 'delete') { deleteRecord(state.view, control.dataset.id); return }
    if (action === 'transition') { transitionTask(control.dataset.id, control.dataset.next); return }
  }
  function start() {
    timeNow()
    window.setInterval(timeNow, 1000)
    document.addEventListener('click', handleClick)
    el('createButton').addEventListener('click', () => {
      if (state.view === 'orders' && !(state.data.customers || []).length) return toast('请先在客户资料中创建客户。', 'warning')
      openForm(state.view)
    })
    el('refreshButton').addEventListener('click', () => loadData())
    $form.addEventListener('submit', submitForm)
    document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => $formDialog.close()))
    document.querySelectorAll('[data-cancel-confirm]').forEach((button) => button.addEventListener('click', () => { state.pendingAction = null; $confirmDialog.close() }))
    el('confirmDeleteButton').addEventListener('click', () => state.pendingAction?.())
    $confirmDialog.addEventListener('close', () => { state.pendingAction = null })
    $formDialog.addEventListener('click', (event) => { if (event.target === $formDialog) $formDialog.close() })
    $confirmDialog.addEventListener('click', (event) => { if (event.target === $confirmDialog) { state.pendingAction = null; $confirmDialog.close() } })
    loadData()
    window.setInterval(() => { if (!document.hidden && !state.mutation) loadData({ quiet: true }) }, 60000)
  }
  start()
})()
