<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useTracking } from '@/composables/tracking'

const route = useRoute()
const { connected } = useTracking()

const navItems = [
  { to: '/map', label: '🗺 地图可视化' },
  { to: '/dashboard', label: '📊 运营仪表盘' },
]

function isActive(to: string) {
  return route.path === to || (to !== '/' && route.path.startsWith(to))
}
</script>

<template>
  <div class="layout">
    <header class="top-bar">
      <div class="brand">🚚 智慧物流配送与路径优化平台</div>
      <nav class="nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="['nav-link', { active: isActive(item.to) }]"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
      <div class="ws-status" :title="connected ? '已连接实时追踪' : '未连接'">
        <span class="dot" :class="{ on: connected }" />
        {{ connected ? '实时追踪在线' : '离线' }}
      </div>
    </header>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f4f6fa;
  font-family: "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif;
}
.top-bar {
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 56px;
  background: linear-gradient(135deg, #1f4e79, #2e75b6);
  color: #fff;
  gap: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.brand { font-size: 17px; font-weight: 600; letter-spacing: 0.5px; }
.nav { display: flex; gap: 4px; }
.nav-link {
  color: rgba(255, 255, 255, 0.8);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.2s;
}
.nav-link:hover { color: #fff; background: rgba(255, 255, 255, 0.12); }
.nav-link.active { color: #fff; background: rgba(255, 255, 255, 0.2); }
.ws-status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}
.dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #c0392b;
}
.dot.on { background: #27ae60; box-shadow: 0 0 6px #27ae60; }
.main { flex: 1; padding: 16px; overflow: auto; }
</style>
