<template>
  <n-card style="max-width: 680px" title="服务器健康检查">
    <n-flex :size="8" align="center">
      <n-button size="small" @click="runChecks" :loading="loading">开始检查</n-button>
      <span v-if="checkedAt" class="text-12px">{{ new Date(checkedAt).toLocaleString() }}</span>
    </n-flex>
    <n-data-table :columns="cols" :data="rows" size="small" class="mt-12px" />
  </n-card>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useMatrixAuthStore } from '@/stores/matrixAuth'
const store = useMatrixAuthStore()
const loading = ref(false)
const checkedAt = ref<number | null>(null)

interface HealthCheckResult {
  name: string
  status: boolean
  detail: string
  [key: string]: unknown
}

const rows = ref<HealthCheckResult[]>([])
const cols = [
  { title: '检查项', key: 'name' },
  { title: '结果', key: 'status', render: (r: HealthCheckResult) => (r.status ? 'OK' : 'FAIL') },
  { title: '详情', key: 'detail' }
]
const fetchJson = async (url: string, init?: RequestInit) => {
  try {
    const resp = await fetch(url, init)
    const text = await resp.text()
    let js: unknown = null
    try {
      js = text ? JSON.parse(text) : null
    } catch {
      js = { text }
    }
    return { ok: resp.ok, data: js, status: resp.status }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, data: { error: msg }, status: 0 }
  }
}
const runChecks = async () => {
  loading.value = true
  rows.value = []
  try {
    const hs = store.getHomeserverBaseUrl() || ''
    const domain = (() => {
      try {
        return new URL(hs).host
      } catch {
        return (hs || '').replace(/^https?:\/\//, '')
      }
    })()
    const well = await fetchJson(`https://${domain}/.well-known/matrix/client`)
    rows.value.push({ name: '.well-known', status: well.ok, detail: JSON.stringify(well.data) })
    const flows = await fetchJson(`${hs.replace(/\/$/, '')}/_matrix/client/v3/login`)
    rows.value.push({ name: 'Matrix Login Flows', status: flows.ok, detail: JSON.stringify(flows.data) })
    const key = await fetchJson(`${hs.replace(/\/$/, '')}/_matrix/key/v2/server`)
    rows.value.push({ name: 'Matrix Key v2', status: key.ok, detail: `status=${key.status}` })
    const adminProxy = '/api/me/is_admin'
    const admin = await fetchJson(adminProxy)
    rows.value.push({ name: 'Admin Proxy', status: admin.ok, detail: JSON.stringify(admin.data) })
    const imSend = await fetchJson('/api/oauth/anyTenant/sendEmailCode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: typeof btoa === 'function' ? btoa('luohuo_web_pro:luohuo_web_pro_secret') : ''
      },
      body: JSON.stringify({ email: 'diag@example.com', operationType: 'register', templateCode: 'REGISTER_EMAIL' })
    })
    rows.value.push({ name: 'IM SendCode', status: imSend.ok, detail: JSON.stringify(imSend.data) })
  } finally {
    checkedAt.value = Date.now()
    loading.value = false
  }
}
</script>
