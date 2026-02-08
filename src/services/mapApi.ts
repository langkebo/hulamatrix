interface MapApiConfig {
  apiKey: string
  secretKey?: string
}

interface Coordinate {
  latitude: number
  longitude: number
}

interface LocationResult {
  address: string
  coordinate: Coordinate
  name?: string
  formatted_addresses?: {
    recommend: string
    rough: string
  }
}

interface SearchResult {
  locations: LocationResult[]
  total: number
}

const mapApiConfig: MapApiConfig = {
  apiKey: ''
}

export function initMapApi(config: MapApiConfig): void {
  mapApiConfig.apiKey = config.apiKey
  mapApiConfig.secretKey = config.secretKey
  console.log('[MapApi] Initialized')
}

export function transformCoordinates(
  lat: number,
  lng: number,
  _from: string = 'wgs84',
  _to: string = 'gcj02'
): Coordinate {
  console.log('[MapApi] transformCoordinates called')
  return { latitude: lat, longitude: lng }
}

export function getStaticMap(
  coordinate: Coordinate,
  zoom: number = 15,
  width: number = 600,
  height: number = 400
): string {
  console.log('[MapApi] getStaticMap called')
  return `https://api.map.baidu.com/staticimage/v2?ak=${mapApiConfig.apiKey}&center=${coordinate.longitude},${coordinate.latitude}&zoom=${zoom}&width=${width}&height=${height}`
}

export async function getCurrentLocation(): Promise<Coordinate> {
  console.log('[MapApi] getCurrentLocation called')
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
        },
        (error) => {
          console.error('[MapApi] Geolocation error:', error)
          reject(error)
        }
      )
    } else {
      reject(new Error('Geolocation not supported'))
    }
  })
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationResult> {
  console.log('[MapApi] reverseGeocode called with:', lat, lng)
  return {
    address: '',
    coordinate: { latitude: lat, longitude: lng }
  }
}

export async function searchNearby(coordinate: Coordinate, radius: number = 1000): Promise<SearchResult> {
  console.log('[MapApi] searchNearby called with:', coordinate, radius)
  return {
    locations: [],
    total: 0
  }
}

export async function searchKeyword(keyword: string, city?: string): Promise<SearchResult> {
  console.log('[ImRequestUtils] searchKeyword called with:', keyword, city)
  return {
    locations: [],
    total: 0
  }
}

export function formatLocationUrl(coordinate: Coordinate, label?: string): string {
  return `geo:${coordinate.latitude},${coordinate.longitude}${label ? `;u=${label}` : ''}`
}
