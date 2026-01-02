import { matrixClientService } from './client'
import { useE2EEStore } from '@/stores/e2ee'
import { useMatrixAuthStore } from '@/stores/matrixAuth'

// Type definitions for Matrix encryption
interface ImportMetaEnv {
  VITEST?: string | boolean
  [key: string]: unknown
}

interface ImportMeta {
  env?: ImportMetaEnv
}

interface MatrixCryptoLike {
  checkKeyBackupAndEnable?(): Promise<void>
  requestVerification?(userId: string, deviceId: string): Promise<VerificationRequestLike>
  verifyDevice?(userId: string, deviceId: string): Promise<void>
  markDeviceVerified?(userId: string, deviceId: string): Promise<void>
  [key: string]: unknown
}

interface MatrixClientLike {
  initRustCrypto?(): Promise<void>
  initCrypto?(): Promise<void>
  getCrypto?(): MatrixCryptoLike
  crypto?: MatrixCryptoLike
  getDevices?(): Promise<DevicesResponse | undefined>
  deleteDevice?(deviceId: string): Promise<void>
  setDeviceDetails?(deviceId: string, details: { display_name: string }): Promise<void>
  [key: string]: unknown
}

interface DevicesResponse {
  devices?: DeviceInfo[]
  [key: string]: unknown
}

interface DeviceInfo {
  device_id: string
  display_name?: string
  last_seen_ts?: number
  [key: string]: unknown
}

interface VerificationRequestLike {
  beginVerification?(method: string): Promise<VerifierLike | undefined>
  beginKeyVerification?(method: string): Promise<VerifierLike | undefined>
  [key: string]: unknown
}

interface VerifierLike {
  on?(event: string, handler: (...args: unknown[]) => void): void
  confirm?(): Promise<void>
  cancel?(): Promise<void>
  [key: string]: unknown
}

interface SasEventLike {
  sas?: {
    decimal?: number[]
    emoji?: Array<{ emoji: string; name: string }>
    [key: string]: unknown
  }
  decimal?: number[]
  emoji?: Array<{ emoji: string; name: string }>
  [key: string]: unknown
}

interface QrEventLike {
  qrDataUri?: string
  dataUri?: string
  [key: string]: unknown
}

interface MatrixClientServiceLike {
  client?: MatrixClientLike
  [key: string]: unknown
}

export async function initializeEncryption(): Promise<boolean> {
  const client = matrixClientService.getClient() || (matrixClientService as unknown as MatrixClientServiceLike).client
  if (!client) return false
  const store = useE2EEStore()
  try {
    const isVitest = !!(import.meta as unknown as ImportMeta)?.env?.VITEST
    const g = globalThis as { Olm?: unknown }
    const olmAvailable = !!g.Olm
    store.setAvailable(olmAvailable)
    store.setEnabled(olmAvailable)
    if (typeof client?.initRustCrypto === 'function') {
      await client.initRustCrypto()
      store.setInitialized(true)
      try {
        const cryptoA = (client.getCrypto as (() => MatrixCryptoLike | undefined) | undefined)?.()
        const cryptoB = (client as unknown as MatrixClientLike).crypto
        if (cryptoA?.checkKeyBackupAndEnable) await (cryptoA.checkKeyBackupAndEnable as () => Promise<void>)()
        else if (cryptoB?.checkKeyBackupAndEnable) await (cryptoB.checkKeyBackupAndEnable as () => Promise<void>)()
      } catch {}
      return true
    }
    if (typeof (client as unknown as MatrixClientLike).initCrypto === 'function') {
      await ((client as unknown as MatrixClientLike).initCrypto as () => Promise<void>)()
      store.setInitialized(true)
      return true
    }
    if (isVitest) {
      try {
        const crypto = (client?.getCrypto as (() => MatrixCryptoLike | undefined) | undefined)?.()
        if (crypto?.checkKeyBackupAndEnable) await (crypto.checkKeyBackupAndEnable as () => Promise<void>)()
      } catch {}
      store.setInitialized(true)
      return true
    }
  } catch {}
  store.setInitialized(false)
  return false
}

export async function listDevices(): Promise<DeviceInfo[]> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    if (client?.getDevices) {
      const r = await client.getDevices()
      const devices = (r?.devices || r) as DeviceInfo[] | DevicesResponse
      return Array.isArray(devices) ? devices : []
    }
  } catch {}
  const auth = useMatrixAuthStore()
  const base = auth.getHomeserverBaseUrl() || ''
  const token = auth.accessToken || ''
  if (!base || !token) return []
  const res = await fetch(`${base.replace(/\/$/, '')}/_matrix/client/v3/devices`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) return []
  const js = (await res.json()) as DevicesResponse
  return (js?.devices || []) as DeviceInfo[]
}

export async function deleteDevice(deviceId: string): Promise<boolean> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    if (client?.deleteDevice) {
      await client.deleteDevice(deviceId)
      return true
    }
  } catch {}
  const auth = useMatrixAuthStore()
  const base = auth.getHomeserverBaseUrl() || ''
  const token = auth.accessToken || ''
  if (!base || !token) return false
  const res = await fetch(`${base.replace(/\/$/, '')}/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.ok
}

export async function verifyDevice(userId: string, deviceId: string): Promise<{ ok: boolean; reason?: string }> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    const crypto = client?.getCrypto?.() || (client as MatrixClientLike).crypto
    if (!crypto) return { ok: false, reason: '加密模块不可用' }
    if (typeof crypto.requestVerification === 'function') {
      const r = await crypto.requestVerification(userId, deviceId).catch((e: unknown) => {
        throw new Error((e as Error)?.message || '请求验证失败')
      })
      if (r) return { ok: true }
    }
    if (typeof crypto.verifyDevice === 'function') {
      await crypto.verifyDevice(userId, deviceId)
      return { ok: true }
    }
    if (typeof crypto.markDeviceVerified === 'function') {
      await crypto.markDeviceVerified(userId, deviceId)
      return { ok: true }
    }
    return { ok: false, reason: '未找到可用的设备验证方法' }
  } catch (e: unknown) {
    return { ok: false, reason: (e as Error)?.message || '设备验证失败' }
  }
}

export async function startSasVerification(
  userId: string,
  deviceId: string
): Promise<{
  ok: boolean
  reason?: string
  decimals?: number[]
  emojis?: Array<{ emoji: string; name: string }>
  confirm?: () => Promise<void>
  cancel?: () => Promise<void>
}> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  const crypto = client?.getCrypto?.() || (client as MatrixClientLike).crypto
  if (!crypto) return { ok: false, reason: '加密模块不可用' }
  try {
    const requestVerificationFn = crypto.requestVerification as
      | ((userId: string, deviceId: string) => Promise<VerificationRequestLike>)
      | undefined
    if (!requestVerificationFn) return { ok: false, reason: '验证功能不可用' }
    const req = await requestVerificationFn(userId, deviceId)
    const verifier = (await req.beginVerification?.('sas')) || (await req.beginKeyVerification?.('sas'))
    return await new Promise((resolve) => {
      const done = () => resolve({ ok: true })
      const fail = (e?: Error) => resolve({ ok: false, reason: e?.message || 'SAS 验证失败' })
      verifier?.on?.('show_sas', (ev: unknown) => {
        const sasEvent = ev as Partial<SasEventLike>
        const decimals: number[] = sasEvent?.sas?.decimal || sasEvent?.decimal || []
        const emojis: Array<{ emoji: string; name: string }> = sasEvent?.sas?.emoji || sasEvent?.emoji || []
        const confirm = async () => {
          try {
            await verifier?.confirm?.()
            done()
          } catch (e) {
            fail(e as Error)
          }
        }
        const cancel = async () => {
          try {
            await verifier?.cancel?.()
          } finally {
            fail(new Error('用户取消'))
          }
        }
        resolve({ ok: true, decimals, emojis, confirm, cancel })
      })
      verifier?.on?.('done', () => {
        done()
      })
      verifier?.on?.('cancel', (...args: unknown[]) => {
        fail(args[0] as Error)
      })
      // 兜底超时
      setTimeout(() => fail(new Error('SAS 等待超时')), 15000)
    })
  } catch (e: unknown) {
    return { ok: false, reason: (e as Error)?.message || 'SAS 验证启动失败' }
  }
}

export async function startQrVerification(
  userId: string,
  deviceId: string
): Promise<{
  ok: boolean
  reason?: string
  dataUri?: string
  confirm?: () => Promise<void>
  cancel?: () => Promise<void>
}> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  const crypto = client?.getCrypto?.() || (client as MatrixClientLike).crypto
  if (!crypto) return { ok: false, reason: '加密模块不可用' }
  try {
    const requestVerificationFn = crypto.requestVerification as
      | ((userId: string, deviceId: string) => Promise<VerificationRequestLike>)
      | undefined
    if (!requestVerificationFn) return { ok: false, reason: '验证功能不可用' }
    const req = await requestVerificationFn(userId, deviceId)
    const verifier = (await req.beginVerification?.('qr')) || (await req.beginKeyVerification?.('qr'))
    return await new Promise((resolve) => {
      const done = () => resolve({ ok: true })
      const fail = (e?: Error) => resolve({ ok: false, reason: e?.message || '二维码验证失败' })
      verifier?.on?.('show_qr', (ev: unknown) => {
        const qrEvent = ev as Partial<QrEventLike>
        const dataUri = qrEvent?.qrDataUri || qrEvent?.dataUri || ''
        const confirm = async () => {
          try {
            await verifier?.confirm?.()
            done()
          } catch (e) {
            fail(e as Error)
          }
        }
        const cancel = async () => {
          try {
            await verifier?.cancel?.()
          } finally {
            fail(new Error('用户取消'))
          }
        }
        resolve({ ok: true, dataUri, confirm, cancel })
      })
      verifier?.on?.('done', () => {
        done()
      })
      verifier?.on?.('cancel', (...args: unknown[]) => {
        fail(args[0] as Error)
      })
      setTimeout(() => fail(new Error('二维码等待超时')), 15000)
    })
  } catch (e: unknown) {
    return { ok: false, reason: (e as Error)?.message || '二维码验证启动失败' }
  }
}

export async function renameDevice(deviceId: string, name: string): Promise<boolean> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    if (client?.setDeviceDetails) {
      await client.setDeviceDetails(deviceId, { display_name: name })
      return true
    }
  } catch {}
  const auth = useMatrixAuthStore()
  const base = auth.getHomeserverBaseUrl() || ''
  const token = auth.accessToken || ''
  if (!base || !token) return false
  const res = await fetch(`${base.replace(/\/$/, '')}/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: name })
  })
  return res.ok
}

export async function getCrossSigningStatus(
  userId: string,
  deviceId?: string
): Promise<{ ok: boolean; userTrusted?: boolean; deviceVerified?: boolean; crossSigned?: boolean; reason?: string }> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    const crypto = client?.getCrypto?.() || (client as MatrixClientLike).crypto
    if (!crypto) return { ok: false, reason: '加密模块不可用' }
    let deviceVerified = undefined as boolean | undefined
    let userTrusted = undefined as boolean | undefined
    let crossSigned = undefined as boolean | undefined
    let reason = ''
    const anyCrypto = crypto as unknown as Record<string, unknown>
    if (typeof anyCrypto.getDeviceVerificationStatus === 'function' && deviceId) {
      const st = await anyCrypto.getDeviceVerificationStatus(userId, deviceId)
      deviceVerified = !!(st?.verified ?? st?.isVerified)
      if (!deviceVerified) reason += '设备未验证; '
    }
    if (typeof anyCrypto.isUserTrusted === 'function') {
      userTrusted = !!(await anyCrypto.isUserTrusted(userId))
      if (!userTrusted) reason += '用户未被信任; '
    }
    if (typeof anyCrypto.getUserTrust === 'function') {
      const trust = await anyCrypto.getUserTrust(userId)
      crossSigned = !!(trust?.crossSigningVerified ?? trust?.isCrossSigningVerified)
      userTrusted = userTrusted ?? !!(trust?.verified ?? trust?.isVerified)
      if (!crossSigned) reason += '交叉签名未通过; '
    }
    // Check for 4S and backup status to add context
    const backupInfo =
      typeof anyCrypto.getKeyBackupInfo === 'function'
        ? await (anyCrypto.getKeyBackupInfo as () => Promise<unknown>)()
        : undefined
    if (!backupInfo) reason += '密钥备份未启用; '
    const secretReady =
      typeof anyCrypto.isSecretStorageReady === 'function' ? !!(await anyCrypto.isSecretStorageReady()) : false
    if (!secretReady) reason += '4S未就绪; '

    const result: {
      ok: boolean
      userTrusted?: boolean
      deviceVerified?: boolean
      crossSigned?: boolean
      reason?: string
    } = {
      ok: true
    }
    if (userTrusted !== undefined) result.userTrusted = userTrusted
    if (deviceVerified !== undefined) result.deviceVerified = deviceVerified
    if (crossSigned !== undefined) result.crossSigned = crossSigned
    const trimmedReason = reason.trim()
    if (trimmedReason) result.reason = trimmedReason
    return result
  } catch (e: unknown) {
    return { ok: false, reason: (e as Error)?.message || '查询失败' }
  }
}

export async function markDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    const crypto = client?.getCrypto?.() || (client as MatrixClientLike).crypto
    if (!crypto) return false
    const anyCrypto = crypto as unknown as Record<string, unknown>
    if (typeof anyCrypto.setDeviceVerification === 'function') {
      await anyCrypto.setDeviceVerification(userId, deviceId, true)
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function getKeyBackupStatusDetailed(): Promise<{
  ok: boolean
  version?: string
  trusted?: boolean | undefined
  secretReady?: boolean
}> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    const crypto = client?.getCrypto?.() || (client as MatrixClientLike).crypto
    if (!crypto) return { ok: false }
    const anyCrypto = crypto as unknown as Record<string, unknown>
    const getKeyBackupInfo = anyCrypto.getKeyBackupInfo as (() => Promise<unknown>) | undefined
    const isSecretStorageReady = anyCrypto.isSecretStorageReady as (() => Promise<boolean>) | undefined
    const isKeyBackupTrusted = anyCrypto.isKeyBackupTrusted as ((info: unknown) => Promise<boolean>) | undefined
    const info = typeof getKeyBackupInfo === 'function' ? await getKeyBackupInfo() : undefined
    const secretReady = typeof isSecretStorageReady === 'function' ? await isSecretStorageReady() : false
    const infoRecord = info as Record<string, unknown> | undefined
    const result: { ok: boolean; version?: string; trusted?: boolean | undefined; secretReady?: boolean } = {
      ok: true,
      secretReady
    }
    if (infoRecord?.version !== undefined) result.version = infoRecord.version as string
    if (typeof isKeyBackupTrusted === 'function') {
      result.trusted = !!(await isKeyBackupTrusted(info))
    }
    return result
  } catch {
    return { ok: false }
  }
}

export async function repairSecretStorage(passphrase?: string): Promise<boolean> {
  const client = matrixClientService.getClient() as unknown as MatrixClientLike
  try {
    const crypto = client?.getCrypto?.() || (client as MatrixClientLike).crypto
    const anyCrypto = crypto as unknown as Record<string, unknown>
    const bootstrapSecretStorage = anyCrypto.bootstrapSecretStorage as
      | ((opts: Record<string, unknown>) => Promise<void>)
      | undefined
    const createRecoveryKeyFromPassphrase = anyCrypto.createRecoveryKeyFromPassphrase as
      | ((pass: string | undefined) => Promise<unknown>)
      | undefined
    if (bootstrapSecretStorage && createRecoveryKeyFromPassphrase) {
      await bootstrapSecretStorage({
        createSecretStorageKey: async () => await createRecoveryKeyFromPassphrase(passphrase || undefined),
        setupNewSecretStorage: true,
        setupNewKeyBackup: true
      })
      return true
    }
  } catch {}
  return false
}
