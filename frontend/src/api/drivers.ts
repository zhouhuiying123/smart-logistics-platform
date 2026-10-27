import http from './http'

export interface Driver {
  id: number
  name: string
  phone: string
  license: string
  status: 'AVAILABLE' | 'ON_DUTY' | 'OFF'
}

export const driversApi = {
  findAll: () => http.get<Driver[]>('/drivers'),
  findOne: (id: number) => http.get<Driver>(`/drivers/${id}`),
  create: (data: Partial<Driver>) => http.post<Driver>('/drivers', data),
  update: (id: number, data: Partial<Driver>) => http.patch<Driver>(`/drivers/${id}`, data),
  remove: (id: number) => http.delete(`/drivers/${id}`),
}
