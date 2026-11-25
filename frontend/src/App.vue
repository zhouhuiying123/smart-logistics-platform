<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useTracking } from '@/composables/tracking'

const route = useRoute()
const { connected } = useTracking()

const icons: Record<string, string> = {
  '/data': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  '/map': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-5.4-7-11a7 7 0 1 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  '/tasks': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg>',
  '/dashboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 20v-6M11 20V5M17 20v-9M3 20h18"/></svg>',
}

const navItems = [
  { to: '/data', label: '基础数据' },
  { to: '/map', label: '地图可视化' },
  { to: '/tasks', label: '调度任务' },
  { to: '/dashboard', label: '运营仪表盘' },
]

function isActive(to: string) {
  return route.path === to || (to !== '/' && route.path.startsWith(to))
}
</script>

<template>
  <div class="layout">
    <header class="top-bar">
      <div class="brand">
        <span class="brand-icon" v-html="icons['/tasks']" />
        智慧物流配送与路径优化平台
      </div>
      <nav class="nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="['nav-link', { active: isActive(item.to) }]"
        >
          <span class="nav-icon" v-html="icons[item.to]" />{{ item.label }}
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

<style>
:root {
  --c-primary: #1b4d7a;
  --c-primary-strong: #142e4d;
  --c-accent: #2e6fa3;
  --c-accent-soft: #eaf1f7;
  --c-success: #2e8b57;
  --c-success-soft: #e4f2ea;
  --c-warn: #c07a1a;
  --c-warn-soft: #f9eedd;
  --c-danger: #b23b32;
  --c-danger-soft: #f9e9e7;
  --c-neutral: #5a6b7c;
  --c-neutral-soft: #edf1f5;
  --c-text: #24384c;
  --c-text-2: #55677a;
  --c-text-3: #8a97a6;
  --c-line: #e3eaf1;
  --c-bg: #f4f6f9;
  --c-card: #ffffff;
  --radius: 10px;
  --shadow: 0 1px 2px rgba(20, 46, 77, 0.04), 0 4px 16px rgba(20, 46, 77, 0.06);
}
body {
  margin: 0;
  font-family: "PingFang SC", "Microsoft YaHei", -apple-system, "Segoe UI", sans-serif;
  color: var(--c-text);
  background: var(--c-bg);
}
</style>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--c-bg);
}
.top-bar {
  display: flex;
  align-items: center;
  padding: 0 32px;
  height: 72px;
  background: linear-gradient(90deg, var(--c-primary-strong), var(--c-primary));
  color: #fff;
  gap: 40px;
  box-shadow: 0 2px 12px rgba(20, 46, 77, 0.18);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1.5px;
  white-space: nowrap;
}
.brand-icon,
.nav-icon { display: inline-flex; }
.brand-icon svg { width: 26px; height: 26px; }
.nav-icon svg { width: 19px; height: 19px; }
.nav { display: flex; gap: 8px; height: 100%; }
.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 72px;
  color: rgba(255, 255, 255, 0.75);
  padding: 0 20px;
  font-size: 16px;
  letter-spacing: 0.5px;
  text-decoration: none;
  position: relative;
  transition: color 0.2s;
}
.nav-link:hover { color: #fff; }
.nav-link.active { color: #fff; font-weight: 600; }
.nav-link.active::after {
  content: "";
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 0;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: #fff;
}
.ws-status {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.85);
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #b3544c; }
.dot.on { background: #6fcf97; box-shadow: 0 0 6px rgba(111, 207, 151, 0.8); }
.main { flex: 1; padding: 24px 28px; overflow: auto; }
</style>
