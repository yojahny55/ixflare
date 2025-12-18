/**
 * npm registry version fetcher
 * Fetches latest version from npm registry with timeout
 */

const NPM_REGISTRY_URL = 'https://registry.npmjs.org'
const FETCH_TIMEOUT_MS = 5000

/**
 * Fetch latest version of a package from npm registry
 * Uses 5-second timeout and graceful failure
 *
 * @param packageName - Package to check
 * @returns Latest version string or null on failure
 */
export async function fetchLatestVersion(packageName: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`${NPM_REGISTRY_URL}/${packageName}/latest`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { version: string }
    return data.version
  } catch {
    // Graceful failure - network error, timeout, or invalid response
    // Do not log or display error to user
    return null
  } finally {
    clearTimeout(timeout)
  }
}
