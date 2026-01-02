import { getSettings } from '@/services/tauriCommand'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'
import { logger } from '@/utils/logger'

type TransformedCoordinate = {
  lat: number
  lng: number
}

type AddressComponent = {
  province: string
  city: string
  district: string
  street: string
  street_number: string
}

type ReverseGeocodeResult = {
  address: string
  formatted_addresses: {
    recommend: string
    rough: string
  }
  address_component: AddressComponent
  ad_info: {
    nation_code: string
    adcode: string
    city_code: string
  }
}

// JSONP回调函数存储
const jsonpCallbacks: { [key: string]: (data: unknown) => void } = {}

// Window type for JSONP callbacks - use type intersection instead of interface extension
type WindowWithJsonpCallbacks = Window & Record<string, ((data: unknown) => void) | undefined>

// 创建JSONP请求
const createJsonpRequest = (url: string, callbackName: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    // 创建script标签
    const script = document.createElement('script')
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('请求超时'))
    }, 10000)

    const cleanup = () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
      // Safe cast to unknown first, then to WindowWithJsonpCallbacks
      const extendedWindow = window as unknown as WindowWithJsonpCallbacks
      delete extendedWindow[callbackName]
      delete jsonpCallbacks[callbackName]
      clearTimeout(timeoutId)
    }

    // 设置全局回调函数
    jsonpCallbacks[callbackName] = (data: unknown) => {
      cleanup()
      resolve(data)
    }
    const extendedWindow = window as unknown as WindowWithJsonpCallbacks
    extendedWindow[callbackName] = jsonpCallbacks[callbackName]

    script.onerror = () => {
      cleanup()
      reject(new Error('脚本加载失败'))
    }

    script.src = `${url}&callback=${callbackName}`
    document.head.appendChild(script)
  })
}

// 腾讯地图API响应类型
interface TencentMapCoordResponse {
  status: number
  message?: string
  locations?: Array<{
    lat: number
    lng: number
  }>
}

interface TencentMapGeocodeResponse {
  status: number
  message?: string
  result?: ReverseGeocodeResult
}

// 坐标系转换（WGS84 -> GCJ-02）
export const transformCoordinates = async (lat: number, lng: number): Promise<TransformedCoordinate> => {
  // 验证坐标范围
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('坐标范围无效')
  }

  // 获取腾讯地图API密钥
  const settings = await getSettings()
  const mapKey = settings.tencent?.map_key || ''

  if (!mapKey) {
    throw new Error('腾讯地图API密钥未配置')
  }

  const callbackName = `coordTransform_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  const params = {
    locations: `${lat},${lng}`,
    type: '1', // GPS坐标(WGS84)
    key: mapKey,
    output: 'jsonp',
    from: '1', // 明确指定源坐标系为GPS
    to: '5' // 明确指定目标坐标系为GCJ02
  }

  try {
    // URLSearchParams only accepts string values, so we need to ensure all values are strings
    const stringParams: Record<string, string> = {
      locations: params.locations,
      type: params.type,
      key: params.key,
      output: params.output,
      from: params.from,
      to: params.to
    }
    const queryString = new URLSearchParams(stringParams).toString()
    const url = `https://apis.map.qq.com/ws/coord/v1/translate?${queryString}`

    const data = (await createJsonpRequest(url, callbackName)) as TencentMapCoordResponse

    logger.debug('腾讯地图API响应:', { data, component: 'mapApi' })

    if (data.status !== 0) {
      const errorMsg = data.message || `状态码: ${data.status}`
      throw new Error(`API错误: ${data.status} - ${errorMsg}`)
    }

    const location = data.locations?.[0]
    if (!location) {
      throw new Error('转换结果为空')
    }

    // 验证返回的坐标
    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      throw new Error('API返回的坐标格式无效')
    }

    const transformed = {
      lat: location.lat,
      lng: location.lng
    }

    return transformed
  } catch (error) {
    logger.warn('腾讯地图API坐标转换失败，使用本地算法转换:', error)

    // 降级方案：使用本地坐标转换算法
    const localTransformed = wgs84ToGcj02(lat, lng)
    return localTransformed
  }
}

// 逆地理编码（获取地址信息）
export const reverseGeocode = async (lat: number, lng: number): Promise<ReverseGeocodeResult | null> => {
  // 验证坐标范围
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('坐标范围无效')
  }

  // 获取腾讯地图API密钥
  const settings = await getSettings()
  const mapKey = settings.tencent?.map_key || ''

  if (!mapKey) {
    throw new Error('腾讯地图API密钥未配置')
  }

  const callbackName = `geocode_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

  const params = {
    location: `${lat},${lng}`,
    key: mapKey,
    get_poi: '1',
    output: 'jsonp'
  }

  try {
    // URLSearchParams only accepts string values
    const stringParams: Record<string, string> = {
      location: params.location,
      key: params.key,
      get_poi: params.get_poi,
      output: params.output
    }
    const queryString = new URLSearchParams(stringParams).toString()
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?${queryString}`

    const data = (await createJsonpRequest(url, callbackName)) as TencentMapGeocodeResponse

    if (data.status !== 0) {
      throw new Error(`API错误: ${data.status} - ${data.message || '未知错误'}`)
    }

    return data.result || null
  } catch (error) {
    logger.warn('腾讯地图API逆地理编码失败:', error)
    return null
  }
}
