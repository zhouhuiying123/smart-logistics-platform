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
}
