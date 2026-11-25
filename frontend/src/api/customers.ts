import http from './http'

export interface Customer {
  id: number
  name: string
  phone: string
  address: string
  lng: number
  lat: number
  timeWindowStart: number
  timeWindowEnd: number
  serviceTime: number
}

export const customersApi = {
  findAll: () => http.get<Customer[]>('/customers'),
  create: (data: Partial<Customer>) => http.post<Customer>('/customers', data),
  update: (id: number, data: Partial<Customer>) => http.patch<Customer>(`/customers/${id}`, data),
  remove: (id: number) => http.delete(`/customers/${id}`),
}
