export function loadBaiduMapSdk(): Promise<void> {
  if (typeof BMap !== 'undefined') return Promise.resolve()

  const key = import.meta.env.VITE_BAIDU_MAP_AK?.trim()
  if (!key || key === 'replace_with_your_baidu_map_browser_key') {
    return Promise.reject(new Error('未配置百度地图浏览器端 AK。请复制 frontend/.env.example 为 .env.local 并填写密钥。'))
  }

  return new Promise((resolve, reject) => {
    const callbackName = `__baiduMapReady_${Date.now()}`
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => finish(new Error('百度地图 SDK 加载超时，请检查网络和 AK 域名白名单。')), 15000)
    let settled = false

    function finish(error?: Error) {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      delete (window as any)[callbackName]
      script.onerror = null
      if (error) reject(error)
      else resolve()
    }

    ;(window as any)[callbackName] = () => {
      if (typeof BMap === 'undefined') finish(new Error('百度地图 SDK 初始化失败，请核对 AK 和网站白名单。'))
      else finish()
    }
    script.onerror = () => finish(new Error('无法下载百度地图 SDK，请检查网络连接。'))
    // Use the standard canvas/raster API. It avoids requiring WebGL rendering
    // support for the street tiles while keeping the same browser AK service.
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(key)}&callback=${callbackName}`
    document.head.appendChild(script)
  })
}
