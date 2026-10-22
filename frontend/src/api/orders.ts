import http from './http'

export interface Customer {
  id: number
  name: string
  phone: string
  address: string
  lng: number
  lat: number
  timeWindowStart?: number
  timeWindowEnd?: number
  serviceTime?: number
}

export interface Order {
  id: number
  customerId: number
  customer?: Customer
  weight: number
  volume: number
  status: 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED' | 'CANCELLED'
  priority?: number
}

export const ordersApi = {
  findAll: () => http.get<Order[]>('/orders'),
  findOne: (id: number) => http.get<Order>(`/orders/${id}`),
  create: (data: Partial<Order>) => http.post<Order>('/orders', data),
  update: (id: number, data: Partial<Order>) => http.patch<Order>(`/orders/${id}`, data),
  remove: (id: number) => http.delete(`/orders/${id}`),
}
