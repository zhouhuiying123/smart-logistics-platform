import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'

const connected = ref(false)
const events = ref<any[]>([])
let socket: Socket | null = null
let consumers = 0

export function useTracking() {
  function connect() {
    consumers += 1
    if (socket) return
    socket = io('/tracking', {
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
    consumers = Math.max(0, consumers - 1)
    if (consumers > 0) return
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  onMounted(connect)
  onUnmounted(disconnect)

  return { connected, events }
}
