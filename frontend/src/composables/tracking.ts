import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'

const connected = ref(false)
const events = ref<any[]>([])
let socket: Socket | null = null

export function useTracking() {
  function connect() {
    if (socket) return
    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })
    socket.on('connect', () => { connected.value = true })
    socket.on('disconnect', () => { connected.value = false })
    socket.on('task.updated', (payload) => {
      events.value.unshift(payload)
      if (events.value.length > 50) events.value.pop()
    })
  }

  function disconnect() {
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  onMounted(connect)
  onUnmounted(disconnect)

  return { connected, events, socket }
}
