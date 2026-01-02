import { fetch } from '@tauri-apps/plugin-http'
import CryptoJS from 'crypto-js'
import { AppException } from '@/common/exception'
import { getSettings, type Settings } from '@/services/tauriCommand'

import { msg } from '@/utils/SafeUI'
import type { TranslateProvider } from './types'

// 有道云翻译接口响应类型
interface YoudaoResponse {
  errorCode: string
  translation?: string[]
  l: string
}

// 腾讯云翻译接口响应类型
interface TencentResponse {
  Response: {
    TargetText: string
    Error?: {
      Message: string
    }
  }
}

// 翻译结果类型
interface TranslateResult {
  text: string
  provider: string
}

// 签名计算工具对象
const signUtils = {
  /**
   * 计算有道云翻译接口签名
   * @param text 待翻译文本
   * @param appKey 应用ID
   * @param salt 随机数
   * @param curtime 当前时间戳
   * @param appSecret 应用密钥
   * @returns 计算得到的签名
   */
  getYoudaoSign(text: string, appKey: string, salt: number, curtime: number, appSecret: string): string {
    // 根据有道云规则处理文本：
    // 如果文本长度小于等于20，直接使用原文；否则使用前10个字符 + 文本长度 + 后10个字符
    const input = text.length <= 20 ? text : `${text.substring(0, 10)}${text.length}${text.substring(text.length - 10)}`
    // 拼接签名原文并计算SHA256哈希
    return CryptoJS.SHA256(appKey + input + salt + curtime + appSecret).toString()
  },

  /**
   * 计算腾讯云翻译接口签名（TC3-HMAC-SHA256算法）
   * @param text 待翻译文本
   * @param secretId 密钥ID
   * @param secretKey 密钥
   * @param timestamp 时间戳
   * @returns 计算得到的Authorization头部值
   */
  getTencentSign(text: string, secretId: string, secretKey: string, timestamp: string): string {
    // 根据时间戳生成UTC日期字符串
    const date = new Date(parseInt(timestamp, 10) * 1000)
    const dateStrPart = date.toISOString().split('T')[0]
    const dateStr = dateStrPart ?? date.toISOString().substring(0, 10)
    const service = 'tmt' // 服务名称

    // 1. 拼接规范请求串
    const payload = {
      SourceText: text, // 待翻译文本
      Source: 'auto', // 源语言，auto为自动识别
      Target: 'zh', // 目标语言，zh为中文
      ProjectId: 0 // 项目ID，默认为0
    }

    // 计算请求体的哈希值
    const hashedRequestPayload = CryptoJS.SHA256(JSON.stringify(payload)).toString()

    // 构造规范请求串
    const canonicalRequest = [
      'POST',
      '/',
      '',
      'content-type:application/json',
      'host:tmt.tencentcloudapi.com',
      '',
      'content-type;host', // 参与签名的头部信息
      hashedRequestPayload // 请求体哈希值
    ].join('\n')

    // 2. 拼接待签名字符串
    const credentialScope = `${dateStr}/${service}/tc3_request`
    const hashedCanonicalRequest = CryptoJS.SHA256(canonicalRequest).toString()
    const stringToSign = ['TC3-HMAC-SHA256', timestamp, credentialScope, hashedCanonicalRequest].join('\n')

    // 3. 计算签名，使用派生密钥计算最终签名
    const secretKeyStr = 'TC3' + secretKey
    const secretKeyWordArray = CryptoJS.enc.Utf8.parse(secretKeyStr)
    if (!secretKeyWordArray) {
      throw new Error('Failed to parse secret key')
    }
    const kDate = CryptoJS.HmacSHA256(dateStr, secretKeyWordArray)
    if (!kDate) {
      throw new Error('Failed to calculate kDate')
    }
    // CryptoJS WordArray can be used as input to HmacSHA256, but types don't match perfectly
    const kService = CryptoJS.HmacSHA256(service, kDate as unknown as string)
    if (!kService) {
      throw new Error('Failed to calculate kService')
    }
    const kSigning = CryptoJS.HmacSHA256('tc3_request', kService as unknown as string)
    if (!kSigning) {
      throw new Error('Failed to calculate kSigning')
    }
    const signature = CryptoJS.HmacSHA256(stringToSign, kSigning as unknown as string)
    if (!signature) {
      throw new Error('Failed to calculate signature')
    }
    const signatureStr = signature.toString()

    // 4. 拼接 Authorization 头部值
    return `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signatureStr}`
  }
}

/**
 * 统一的翻译函数入口
 * @param text 待翻译文本
 * @param provider 翻译服务提供商，默认为有道云
 * @returns 翻译结果和提供商信息
 */
export const translateText = async (text: string, provider: TranslateProvider = 'youdao'): Promise<TranslateResult> => {
  // 检查输入文本是否为空
  if (!text?.trim()) {
    throw new AppException('翻译文本不能为空')
  }

  try {
    // 根据提供商选择对应的翻译实现
    switch (provider) {
      case 'youdao':
        return await youdaoTranslate(text)
      case 'tencent':
        return await tencentTranslate(text)
      default:
        msg.error('不支持的翻译服务提供商')
        throw new AppException('不支持的翻译服务提供商')
    }
  } catch (error) {
    msg.error('翻译失败: ' + (error as Error).message)
    throw error
  }
}

/**
 * 有道云翻译实现
 * @param text 待翻译文本
 * @returns 翻译结果和提供商信息
 */
const youdaoTranslate = async (text: string): Promise<TranslateResult> => {
  // 从环境变量获取密钥信息
  const settings: Settings = await getSettings()

  // 检查密钥是否为空
  if (!settings.youdao.app_key || !settings.youdao.app_secret) {
    msg.error('有道翻译API密钥未配置')
    throw new AppException('有道翻译API密钥未配置')
  }

  const salt = new Date().getTime() // 随机数，使用时间戳
  const curtime = Math.round(new Date().getTime() / 1000) // 当前时间戳

  // 计算签名
  const sign = signUtils.getYoudaoSign(text, settings.youdao.app_key, salt, curtime, settings.youdao.app_secret)

  // 发送翻译请求
  const response = await fetch('https://openapi.youdao.com/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      q: text, // 待翻译文本
      from: 'auto', // 源语言
      to: 'zh-CHS', // 目标语言
      appKey: settings.youdao.app_key, // 应用ID
      salt: salt.toString(), // 随机数
      sign, // 签名
      signType: 'v3', // 签名类型
      curtime: curtime.toString() // 时间戳
    }).toString()
  })

  const data = (await response.json()) as YoudaoResponse

  // 处理错误响应
  if (data.errorCode !== '0') {
    msg.error(`翻译失败，错误码：${data.errorCode}`)
    throw new AppException(`翻译失败，错误码：${data.errorCode}`)
  }

  // 检查翻译结果
  if (!data.translation?.[0]) {
    throw new AppException('未获取到翻译结果')
  }

  return {
    text: data.translation[0],
    provider: '有道云翻译'
  }
}

/**
 * 腾讯云翻译实现
 * @param text 待翻译文本
 * @returns 翻译结果和提供商信息
 */
const tencentTranslate = async (text: string): Promise<TranslateResult> => {
  // 从环境变量获取密钥信息
  const settings: Settings = await getSettings()
  const secretId = settings.tencent.secret_id || ''
  const secretKey = settings.tencent.api_key || ''

  // 检查密钥是否为空
  if (!secretId || !secretKey) {
    msg.error('腾讯云翻译API密钥未配置')
    throw new AppException('腾讯云翻译API密钥未配置')
  }

  const timestamp = Math.floor(Date.now() / 1000).toString()

  // 计算签名
  const sign = signUtils.getTencentSign(text, secretId, secretKey, timestamp)

  // 发送翻译请求
  const response = await fetch('https://tmt.tencentcloudapi.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TC-Action': 'TextTranslate', // 接口名称
      'X-TC-Version': '2018-03-21', // 接口版本
      'X-TC-Region': 'ap-guangzhou', // 地域
      'X-TC-Timestamp': timestamp, // 时间戳
      'X-TC-SecretId': secretId, // 密钥ID
      Authorization: sign // 签名
    },
    body: JSON.stringify({
      SourceText: text, // 待翻译文本
      Source: 'auto', // 源语言
      Target: 'zh', // 目标语言
      ProjectId: 0 // 项目ID
    })
  })

  const data = (await response.json()) as TencentResponse

  // 处理错误响应
  if (data.Response.Error) {
    msg.error(`翻译失败，错误码：${data.Response.Error.Message}`)
    throw new AppException(`翻译失败，错误码：${data.Response.Error.Message}`)
  }

  // 检查翻译结果
  if (!data.Response.TargetText) {
    throw new AppException('未获取到翻译结果')
  }

  return {
    text: data.Response.TargetText,
    provider: '腾讯云翻译'
  }
}
