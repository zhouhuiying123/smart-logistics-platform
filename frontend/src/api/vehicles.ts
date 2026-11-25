import http from './http'

export interface Vehicle {
  id: number
  plate: string
  capacityW: number
  capacityV: number
  status: 'IDLE' | 'ON_DUTY' | 'MAINTENANCE'
}

export const vehiclesApi = {
  findAll: () => http.get<Vehicle[]>('/vehicles'),
  findOne: (id: number) => http.get<Vehicle>(`/vehicles/${id}`),
  create: (data: Partial<Vehicle>) => http.post<Vehicle>('/vehicles', data),
  update: (id: number, data: Partial<Vehicle>) => http.patch<Vehicle>(`/vehicles/${id}`, data),
  remove: (id: number) => http.delete(`/vehicles/${id}`),
}
