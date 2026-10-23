import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/map' },
    { path: '/map', name: 'map', component: () => import('@/views/MapView.vue'), meta: { title: '地图可视化' } },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '运营仪表盘' } },
  ],
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? '智慧物流'} · 智慧物流配送与路径优化平台`
})

export default router
