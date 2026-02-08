<template>
  <n-card :title="t('gdpr.title')" :bordered="false" class="gdpr-panel">
    <n-alert type="warning" :bordered="false" class="mb-4">
      <template #icon>
        <svg class="size-20px"><use href="#warning"></use></svg>
      </template>
      {{ t('gdpr.warning_message') }}
    </n-alert>

    <n-tabs type="line" animated>
      <n-tab-pane :name="'export'" :tab="t('gdpr.export_data')">
        <n-flex :size="16" vertical>
          <n-form ref="exportFormRef" :model="exportOptions" label-placement="top" label-width="auto">
            <n-form-item :label="t('gdpr.export_options')">
              <n-flex :size="16" vertical>
                <n-checkbox v-model:checked="exportOptions.includeProfile">{{ t('gdpr.include_profile') }}</n-checkbox>
                <n-checkbox v-model:checked="exportOptions.includeRooms">{{ t('gdpr.include_rooms') }}</n-checkbox>
                <n-checkbox v-model:checked="exportOptions.includeMessages">{{ t('gdpr.include_messages') }}</n-checkbox>
                <n-checkbox v-model:checked="exportOptions.includeContacts">{{ t('gdpr.include_contacts') }}</n-checkbox>
              </n-flex>
            </n-form-item>

            <n-form-item :label="t('gdpr.date_range')">
              <n-date-picker
                v-model:value="dateRange"
                type="daterange"
                clearable
                :placeholder="t('gdpr.select_date_range')" />
            </n-form-item>
          </n-form>

          <n-divider style="margin: 8px 0" />

          <n-flex :size="12" vertical>
            <div class="text-14px font-medium">{{ t('gdpr.export_actions') }}</div>

            <n-button type="primary" @click="handleExport" :loading="exporting" :disabled="!hasExportOptions">
              <template #icon>
                <svg class="size-16px"><use href="#download"></use></svg>
              </template>
              {{ t('gdpr.export_button') }}
            </n-button>
          </n-flex>

          <n-progress
            v-if="exporting"
            type="line"
            :percentage="exportProgress.progress"
            :status="exportProgress.stage === 'completed' ? 'success' : 'default'">
            <template #default="{ percentage }">
              {{ t('gdpr.export_stage', { stage: t(`gdpr.stages.${exportProgress.stage}`), percentage }) }}
            </template>
          </n-progress>
        </n-flex>
      </n-tab-pane>

      <n-tab-pane :name="'delete'" :tab="t('gdpr.delete_data')">
        <n-flex :size="16" vertical>
          <n-alert type="error" :bordered="false">
            <template #icon>
              <svg class="size-20px"><use href="#alert-triangle"></use></svg>
            </template>
            {{ t('gdpr.delete_warning') }}
          </n-alert>

          <n-card :title="t('gdpr.data_preview')" size="small" :bordered="false">
            <n-spin :show="loadingPreview">
              <n-descriptions :column="1" bordered size="small">
                <n-descriptions-item :label="t('gdpr.messages')">
                  {{ preview.messages }}
                </n-descriptions-item>
                <n-descriptions-item :label="t('gdpr.rooms')">
                  {{ preview.rooms }}
                </n-descriptions-item>
                <n-descriptions-item :label="t('gdpr.contacts')">
                  {{ preview.contacts }}
                </n-descriptions-item>
              </n-descriptions>
            </n-spin>
          </n-card>

          <n-form ref="deleteFormRef" :model="deleteOptions" label-placement="top" label-width="auto">
            <n-form-item :label="t('gdpr.delete_options')">
              <n-flex :size="16" vertical>
                <n-checkbox v-model:checked="deleteOptions.deleteMessages">{{ t('gdpr.delete_messages') }}</n-checkbox>
                <n-checkbox v-model:checked="deleteOptions.deleteRooms">{{ t('gdpr.delete_rooms') }}</n-checkbox>
                <n-checkbox v-model:checked="deleteOptions.deleteContacts">{{ t('gdpr.delete_contacts') }}</n-checkbox>
                <n-checkbox v-model:checked="deleteOptions.deleteProfile">{{ t('gdpr.delete_profile') }}</n-checkbox>
              </n-flex>
            </n-form-item>

            <n-form-item :label="t('gdpr.date_range')">
              <n-date-picker
                v-model:value="deleteDateRange"
                type="daterange"
                clearable
                :placeholder="t('gdpr.select_date_range')" />
            </n-form-item>
          </n-form>

          <n-divider style="margin: 8px 0" />

          <n-flex :size="12" vertical>
            <div class="text-14px font-medium">{{ t('gdpr.delete_actions') }}</div>

            <n-button type="error" @click="handleDelete" :loading="deleting" :disabled="!hasDeleteOptions">
              <template #icon>
                <svg class="size-16px"><use href="#trash"></use></svg>
              </template>
              {{ t('gdpr.delete_button') }}
            </n-button>

            <n-button type="error" @click="handleDeleteAccount" :loading="deleting">
              <template #icon>
                <svg class="size-16px"><use href="#user-x"></use></svg>
              </template>
              {{ t('gdpr.delete_account_button') }}
            </n-button>
          </n-flex>

          <n-progress
            v-if="deleting"
            type="line"
            :percentage="deleteProgress.progress"
            :status="deleteProgress.stage === 'completed' ? 'success' : 'error'">
            <template #default="{ percentage }">
              {{ t('gdpr.delete_stage', { stage: t(`gdpr.stages.${deleteProgress.stage}`), percentage }) }}
            </template>
          </n-progress>
        </n-flex>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import MatrixDataExportService from '@/services/matrix/MatrixDataExportService'
import MatrixDataDeletionService from '@/services/matrix/MatrixDataDeletionService'

const { t } = useI18n()
const exportService = MatrixDataExportService.getInstance()
const deletionService = MatrixDataDeletionService.getInstance()

const exportFormRef = ref()
const deleteFormRef = ref()

const exportOptions = ref({
  includeProfile: true,
  includeRooms: true,
  includeMessages: true,
  includeContacts: true,
  startDate: undefined as Date | undefined,
  endDate: undefined as Date | undefined
})

const deleteOptions = ref({
  deleteMessages: false,
  deleteRooms: false,
  deleteContacts: false,
  deleteProfile: false,
  deleteAccount: false,
  startDate: undefined as Date | undefined,
  endDate: undefined as Date | undefined
})

const dateRange = ref<[number, number] | null>(null)
const deleteDateRange = ref<[number, number] | null>(null)

const exporting = ref(false)
const deleting = ref(false)
const loadingPreview = ref(false)

const exportProgress = ref({ stage: 'idle', progress: 0, total: 100 })
const deleteProgress = ref({ stage: 'idle', progress: 0, total: 100 })

const preview = ref({
  messages: 0,
  rooms: 0,
  contacts: 0
})

const hasExportOptions = computed(() => {
  return (
    exportOptions.value.includeProfile ||
    exportOptions.value.includeRooms ||
    exportOptions.value.includeMessages ||
    exportOptions.value.includeContacts
  )
})

const hasDeleteOptions = computed(() => {
  return (
    deleteOptions.value.deleteMessages ||
    deleteOptions.value.deleteRooms ||
    deleteOptions.value.deleteContacts ||
    deleteOptions.value.deleteProfile
  )
})

const loadPreview = async () => {
  try {
    loadingPreview.value = true
    preview.value = await deletionService.getDeletionPreview()
  } catch (error) {
    console.error('Failed to load deletion preview:', error)
  } finally {
    loadingPreview.value = false
  }
}

const handleExport = async () => {
  try {
    exporting.value = true
    exportProgress.value = { stage: 'exporting_profile', progress: 0, total: 100 }

    if (dateRange.value) {
      exportOptions.value.startDate = new Date(dateRange.value[0])
      exportOptions.value.endDate = new Date(dateRange.value[1])
    }

    const result = await exportService.exportData(exportOptions.value, (progress) => {
      exportProgress.value = progress
    })

    if (result.success && result.blob && result.filename) {
      await exportService.downloadExport(result)
      window.$message.success(t('gdpr.export_success'))
    } else {
      window.$message.error(result.error || t('gdpr.export_failed'))
    }
  } catch (error) {
    console.error('Failed to export data:', error)
    window.$message.error(t('gdpr.export_failed'))
  } finally {
    exporting.value = false
  }
}

const handleDelete = async () => {
  window.$dialog.warning({
    title: t('gdpr.delete_confirm_title'),
    content: t('gdpr.delete_confirm_message'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        deleting.value = true
        deleteProgress.value = { stage: 'deleting_messages', progress: 0, total: 100 }

        if (deleteDateRange.value) {
          deleteOptions.value.startDate = new Date(deleteDateRange.value[0])
          deleteOptions.value.endDate = new Date(deleteDateRange.value[1])
        }

        const result = await deletionService.deleteData(deleteOptions.value, (progress) => {
          deleteProgress.value = progress
        })

        if (result.success) {
          window.$message.success(
            t('gdpr.delete_success', {
              messages: result.deletedItems.messages,
              rooms: result.deletedItems.rooms,
              contacts: result.deletedItems.contacts
            })
          )
          await loadPreview()
        } else {
          window.$message.error(result.error || t('gdpr.delete_failed'))
        }
      } catch (error) {
        console.error('Failed to delete data:', error)
        window.$message.error(t('gdpr.delete_failed'))
      } finally {
        deleting.value = false
      }
    }
  })
}

const handleDeleteAccount = () => {
  window.$dialog.error({
    title: t('gdpr.delete_account_title'),
    content: t('gdpr.delete_account_message'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        deleting.value = true
        deleteProgress.value = { stage: 'deleting_account', progress: 0, total: 100 }

        const result = await deletionService.deleteData(
          {
            deleteMessages: false,
            deleteRooms: false,
            deleteContacts: false,
            deleteProfile: false,
            deleteAccount: true
          },
          (progress) => {
            deleteProgress.value = progress
          }
        )

        if (result.success) {
          window.$message.success(t('gdpr.delete_account_success'))
          setTimeout(() => {
            window.location.href = '/'
          }, 2000)
        } else {
          window.$message.error(result.error || t('gdpr.delete_account_failed'))
        }
      } catch (error) {
        console.error('Failed to delete account:', error)
        window.$message.error(t('gdpr.delete_account_failed'))
      } finally {
        deleting.value = false
      }
    }
  })
}

onMounted(() => {
  loadPreview()
})
</script>

<style scoped>
.gdpr-panel {
  background: var(--bg-color);
}
</style>
