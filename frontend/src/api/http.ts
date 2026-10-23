import axios, { type AxiosRequestConfig } from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err?.response?.data?.message ?? err.message
    console.error('[API]', msg)
    return Promise.reject(err)
  },
)

// 响应拦截器已 unwrap res.data，所以实际返回类型是 T 而非 AxiosResponse<T>
// 这里覆盖 axios 方法的类型签名，让 TS 正确推断返回类型
export interface Http {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

export default http as unknown as Http
