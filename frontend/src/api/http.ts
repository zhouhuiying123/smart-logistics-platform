import axios from 'axios'

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

export default http
