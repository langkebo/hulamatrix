import { AutoDiscovery } from 'matrix-js-sdk'

const DEFAULT_HOMESERVER = 'https://matrix.cjystx.top'
const DEFAULT_SERVER_NAME = 'cjystx.top'

export async function discoverHomeserver(domainOrUrl: string = DEFAULT_SERVER_NAME): Promise<string> {
  let domain = domainOrUrl

  if (domainOrUrl.startsWith('https://')) {
    domain = domainOrUrl.replace('https://', '').replace(/\/$/, '')
  } else if (domainOrUrl.startsWith('http://')) {
    domain = domainOrUrl.replace('http://', '').replace(/\/$/, '')
  }

  domain = domain.split('/')[0]

  try {
    console.log(`[ServerDiscovery] Starting discovery for domain: ${domain}`)
    const discoveryResult = await AutoDiscovery.findClientConfig(domain)
    const homeserver = discoveryResult['m.homeserver']

    if (homeserver && homeserver.state === 'SUCCESS' && homeserver.base_url) {
      console.log(`[ServerDiscovery] Well-known discovery successful: ${homeserver.base_url}`)
      return homeserver.base_url
    }

    console.log(
      `[ServerDiscovery] Well-known discovery failed, trying direct URL: ${homeserver?.error || 'Unknown error'}`
    )
  } catch (error) {
    console.log(`[ServerDiscovery] Well-known discovery error: ${error}`)
  }

  const directUrl = `https://${domain}`
  console.log(`[ServerDiscovery] Using direct URL: ${directUrl}`)
  return directUrl
}

export function getDefaultHomeserver(): string {
  return DEFAULT_HOMESERVER
}

export function getDefaultServerName(): string {
  return DEFAULT_SERVER_NAME
}

export async function validateHomeserver(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/_matrix/client/versions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    return response.ok
  } catch (error) {
    console.error(`[ServerDiscovery] Failed to validate homeserver ${baseUrl}:`, error)
    return false
  }
}
