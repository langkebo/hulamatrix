import { ref, defineComponent } from 'vue'
import { storeToRefs } from 'pinia'
import { type FormInst, NAvatar, NButton, NFlex, NForm, NFormItem, NInput, NModal } from 'naive-ui'
import { emit } from '@tauri-apps/api/event'
import { EventEnum } from '@/enums'
import './style.scss'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isMac } from '@/utils/PlatformConstants'
import { useI18n } from 'vue-i18n'
import { useTimerManager } from '@/composables/useTimerManager'

const formRef = ref<FormInst | null>()
const formValue = ref({
  lockPassword: ''
})
export const modalShow = ref(false)
export const lock = ref({
  loading: false,
  rules: {
    lockPassword: {
      required: true,
      message: '',
      trigger: ['input']
    }
  },
  async handleLock() {
    const settingStore = useSettingStore()
    const { lockScreen } = storeToRefs(settingStore)
    formRef.value?.validate((errors) => {
      if (errors) return
      lock.value.loading = true
      lockScreen.value.password = formValue.value.lockPassword
      lockScreen.value.enable = true
      useTimerManager().setTimer(async () => {
        /** 发送锁屏事件，当打开的窗口接受到后会自动锁屏 */
        await emit(EventEnum.LOCK_SCREEN)
        lock.value.loading = false
        modalShow.value = false
        formValue.value.lockPassword = ''
      }, 1000)
    })
    formRef.value?.restoreValidation()
  }
})

/*============================================ model =====================================================*/
/**  锁屏弹窗 */
export const LockScreen = defineComponent(() => {
  const userStore = useUserStore()
  const { t } = useI18n()
  lock.value.rules.lockPassword.message = t('message.lock_screen.validation_required')
  return () => (
    <NModal v-model:show={modalShow.value} maskClosable={false} class="w-350px border-rd-8px">
      <div class="bg-[--bg-popover] w-360px h-full p-6px box-border flex flex-col">
        {isMac() ? (
          <div
            onClick={() => (modalShow.value = false)}
            class="mac-close relative size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none">
            <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
              <use href="#close"></use>
            </svg>
          </div>
        ) : (
          <svg onClick={() => (modalShow.value = false)} class="w-12px h-12px ml-a cursor-pointer select-none">
            <use href="#close"></use>
          </svg>
        )}
        <div class="flex flex-col gap-10px p-10px select-none">
          <NFlex vertical justify="center" align="center" size={20}>
            <span class="text-(14px center)">{t('message.lock_screen.title')}</span>

            <NAvatar bordered round size={80} src={AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar!)} />

            <p class="text-(14px center [--text-color]) truncate w-200px">{userStore.userInfo!.name}</p>
          </NFlex>
          <NForm ref={formRef} model={formValue.value} rules={lock.value.rules}>
            <NFormItem
              label-placement="left"
              label={t('message.lock_screen.password_label')}
              path={'lockPassword'}
              class="w-full">
              <NInput
                show-password-on="click"
                v-model:value={formValue.value.lockPassword}
                class="border-(1px solid #ccc)"
                size="small"
                type="password"
                placeholder={t('message.lock_screen.password_placeholder')}
              />
            </NFormItem>
          </NForm>

          <NButton loading={lock.value.loading} onClick={lock.value.handleLock} class="w-full" color="#13987f">
            {t('message.lock_screen.confirm_button')}
          </NButton>
        </div>
      </div>
    </NModal>
  )
})
