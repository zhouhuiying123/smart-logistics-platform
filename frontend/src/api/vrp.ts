import http from './http'

export interface OptimizeRequest {
  orderIds: number[]
  vehicleIds: number[]
  algorithm?: 'CVRP-GA' | 'VRPTW-GA' | 'NSGA-II'
}

export interface RouteStop {
  orderId: number
  seq: number
  lng: number
  lat: number
}

export interface VehicleRoute {
  vehicleId: number
  distance: number
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
    vehicles: VehicleRoute[]
  }>
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
    http.post<OptimizeResult>('/vrp/optimize', data),
  confirm: (data: ConfirmRequest) =>
    http.post<{ message: string; taskIds: number[] }>('/vrp/confirm', data),
  distanceMatrix: (points: DistancePoint[]) =>
    http.post<number[][]>('/vrp/distance-matrix', { points }),
}
