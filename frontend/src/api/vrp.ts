import http from './http'

export interface OptimizeRequest {
  orderIds: number[]
  vehicleIds: number[]
  algorithm?: 'CVRP-GA' | 'VRPTW-GA' | 'NSGA-II'
  depot: { lng: number; lat: number }
}

export interface RouteStop {
  orderId: number
  seq: number
  lng: number
  lat: number
}

export interface VehicleRoute {
  vehicleId: number
  totalDistance: number
  stops: RouteStop[]
}

export interface OptimizeResult {
  previewId: string
  solutions: Array<{
    id: string
    algorithm: string
    totalDistance: number
    totalCost: number | null
    feasible: boolean
    routes: VehicleRoute[]
  }>
}

export interface OptimizeResponse {
  previewId?: string
  previewExpiresAt?: string
  status: 'FOUND' | 'NOT_FOUND'
  algorithm: 'CVRP-GA' | 'VRPTW-GA' | 'NSGA-II'
  solutionId?: string
  routes?: VehicleRoute[]
  solutions?: Array<{
    solutionId: string
    routes: VehicleRoute[]
    totalDistance: number
    totalCost?: number | null
  }>
  totalDistance?: number
  totalCost?: number | null
}

export interface ConfirmRequest {
  previewId: string
  solutionId: string
  assignments: Array<{ vehicleId: number; driverId: number }>
}

export interface DistancePoint {
  lng: number
  lat: number
  id?: number | string
}

export const vrpApi = {
  optimize: (data: OptimizeRequest) =>
    http.post<OptimizeResponse>('/vrp/optimize', data),
  confirm: (data: ConfirmRequest) =>
    http.post<{ previewId: string; solutionId: string; tasks: Array<{ id: number }>; message: string }>('/vrp/confirm', data),
  distanceMatrix: (points: DistancePoint[]) =>
    http.post<number[][]>('/vrp/distance-matrix', { points }),
}
