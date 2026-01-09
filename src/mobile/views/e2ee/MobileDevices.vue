<!-- Mobile E2EE Devices View - Main page for device management on mobile -->
<template>
  <div class="mobile-devices-view">
    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <n-button text @click="goBack">
          <template #icon>
            <n-icon :size="20"><ArrowLeft /></n-icon>
          </template>
        </n-button>
      </div>
      <div class="header-title">设备管理</div>
      <div class="header-right">
        <n-button text @click="showHelp = true">
          <template #icon>
            <n-icon :size="20"><HelpIcon /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- E2EE Status Warning -->
    <n-alert v-if="!e2eeEnabled" type="warning" :show-icon="true" class="status-alert">
      端到端加密功能未启用，请设置
      <code>VITE_MATRIX_E2EE_ENABLED=on</code>
      后重启应用
    </n-alert>

    <!-- Content -->
    <div class="view-content">
      <MobileDeviceList />
    </div>

    <!-- Help Dialog -->
    <n-modal v-model:show="showHelp" preset="card" title="设备验证帮助" class="w-90-max-w-400px">
      <div class="help-content">
        <h4>什么是设备验证？</h4>
        <p>设备验证确保只有您信任的设备才能参与加密通信。验证所有设备后，您可以获得更高的安全性。</p>

        <h4>如何验证设备？</h4>
        <ol>
          <li>在设备列表中找到未验证的设备</li>
          <li>点击"验证"按钮</li>
          <li>选择 SAS 表情符号或二维码验证方式</li>
          <li>在两个设备上确认显示的信息一致</li>
          <li>完成验证</li>
        </ol>

        <h4>安全级别说明</h4>
        <ul>
          <li>
            <strong>高安全性</strong>
            : 所有设备已验证，密钥已备份
          </li>
          <li>
            <strong>中等安全性</strong>
            : 部分设备已验证
          </li>
          <li>
            <strong>低安全性</strong>
            : 存在未验证设备
          </li>
        </ul>

        <n-alert type="warning" :show-icon="true" class="mt-12px">
          建议：定期验证新设备，并创建密钥备份以防止数据丢失
        </n-alert>
      </div>

      <template #footer>
        <n-button type="primary" block @click="showHelp = false">我知道了</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NIcon, NAlert, NModal } from 'naive-ui'
import { ArrowLeft, Help as HelpIcon } from '@vicons/tabler'
import { flags } from '@/utils/envFlags'
import MobileDeviceList from '@/mobile/components/e2ee/MobileDeviceList.vue'
import { initializeEncryption } from '@/integrations/matrix/encryption'

const router = useRouter()
const showHelp = ref(false)

const e2eeEnabled = computed(() => flags.matrixE2eeEnabled)

const goBack = () => {
  router.back()
}

onMounted(async () => {
  // Initialize encryption if not already initialized
  if (e2eeEnabled.value) {
    await initializeEncryption()
  }
})
</script>

<style scoped lang="scss">
.mobile-devices-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color);
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--card-color);
  border-bottom: 1px solid var(--divider-color);
  position: sticky;
  top: 0;
  z-index: 10;

  .header-left,
  .header-right {
    width: 32px;
    display: flex;
    align-items: center;
  }

  .header-right {
    justify-content: flex-end;
  }

  .header-title {
    flex: 1;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-color-1);
  }
}

.status-alert {
  margin: 12px 16px;

  :deep(code) {
    padding: 2px 6px;
    background: var(--bg-color);
    border-radius: 4px;
    font-size: 12px;
    font-family: 'Courier New', monospace;
  }
}

.view-content {
  flex: 1;
  overflow-y: auto;
}

.help-content {
  h4 {
    margin: 16px 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-color-1);

    &:first-child {
      margin-top: 0;
    }
  }

  p {
    font-size: 13px;
    color: var(--text-color-2);
    margin: 8px 0;
    line-height: 1.5;
  }

  ol,
  ul {
    margin: 8px 0;
    padding-left: 20px;
    font-size: 13px;
    color: var(--text-color-2);
    line-height: 1.6;
  }

  li {
    margin: 4px 0;
  }

  strong {
    font-weight: 600;
    color: var(--text-color-1);
  }
}
</style>
