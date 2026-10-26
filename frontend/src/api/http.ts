import axios from 'axios'
import { ordersRepo, vehiclesRepo, driversRepo, tasksRepo, mockOptimize, mockConfirm, mockDistanceMatrix } from '@/mock'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

const http = axios.create({
  baseURL: '/api',
  timeout: 8000,
})

function matchKey(method: string, url: string): string {
  const base = url.split('/').filter(Boolean).slice(0, 2).join('/')
  return `${method.toLowerCase()}:/${base}`
}

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err?.response?.status
    if (USE_MOCK || !status || status >= 500) {
      if (!USE_MOCK) console.warn('[API] 后端不可用，自动启用 mock 数据')
      return mockFallback(err.config)
    }
    const msg = err?.response?.data?.message ?? err.message
    console.error('[API]', msg)
    return Promise.reject(err)
  },
)

async function mockFallback(config: { method: string; url: string; data?: any }) {
  const { method, url } = config
  const repoMap: Record<string, any> = {
    orders: ordersRepo, vehicles: vehiclesRepo, drivers: driversRepo, 'dispatch-tasks': tasksRepo,
  }
  const parts = url.split('/').filter(Boolean)
  const resource = parts[0]
  const repo = repoMap[resource]
  const body = config.data ? JSON.parse(config.data) : {}

  // /resource/:id
  if (repo && parts.length === 2) {
    const id = parseInt(parts[1], 10)
    const m = method?.toLowerCase()
    if (m === 'get') return repo.findOne(id)
    if (m === 'patch') return repo.update(id, body)
    if (m === 'delete') return repo.remove(id)
  }
  // /resource
  if (repo && parts.length === 1) {
    const m = method?.toLowerCase()
    if (m === 'get') return repo.findAll()
    if (m === 'post') return repo.create(body)
  }
  // /vrp/*
  if (url.startsWith('/vrp/optimize')) return mockOptimize(body)
  if (url.startsWith('/vrp/confirm')) return mockConfirm(body)
  if (url.startsWith('/vrp/distance-matrix')) return mockDistanceMatrix(body.points)

  return Promise.reject(new Error(`mock not found for ${method} ${url}`))
}

export default http
