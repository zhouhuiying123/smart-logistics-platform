import http from './http'

export interface DispatchStop {
  id: number
  taskId: number
  orderId: number
  seq: number
  lng: number
  lat: number
  arrived: boolean
  order?: { id: number; customer?: { name: string; address: string } }
}

export interface DispatchTask {
  id: number
  vehicleId: number
  driverId: number
  status: 'CREATED' | 'ASSIGNED' | 'STARTED' | 'COMPLETED' | 'CANCELLED'
  startTime?: string
  endTime?: string
  totalDist?: number
  totalCost?: number
  vehicle?: { id: number; plate: string; status: string }
  driver?: { id: number; name: string; status: string }
  stops?: DispatchStop[]
}

export const dispatchApi = {
  findAll: () => http.get<DispatchTask[]>('/dispatch-tasks'),
  findOne: (id: number) => http.get<DispatchTask>(`/dispatch-tasks/${id}`),
  create: (data: Partial<DispatchTask>) => http.post<DispatchTask>('/dispatch-tasks', data),
  update: (id: number, data: Partial<DispatchTask>) => http.patch<DispatchTask>(`/dispatch-tasks/${id}`, data),
  remove: (id: number) => http.delete(`/dispatch-tasks/${id}`),
}
