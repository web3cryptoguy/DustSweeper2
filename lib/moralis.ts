import { getMoralisApiKeys } from "@/lib/config"

const DEFAULT_HEADERS = {
  accept: "application/json",
}

/**
 * Fetch JSON from Moralis with API key rotation and basic retry on 5xx.
 * - Tries keys in order until a successful 2xx response
 * - Treats 401/403/429 as key-specific failures and moves to next key
 * - Retries 5xx errors up to maxRetries per key with small backoff
 */
export async function fetchMoralisJson<T = unknown>(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: BodyInit | null; maxRetriesPerKey?: number }
): Promise<{ ok: true; data: T } | { ok: false; status: number; statusText: string; errorText?: string }> {
  const keys = getMoralisApiKeys()
  const maxRetriesPerKey = options?.maxRetriesPerKey ?? 1

  if (!keys || keys.length === 0) {
    return { ok: false, status: 500, statusText: "No Moralis API keys configured" }
  }

  for (let k = 0; k < keys.length; k++) {
    const apiKey = keys[k]

    for (let attempt = 0; attempt <= maxRetriesPerKey; attempt++) {
      const res = await fetch(url, {
        method: options?.method ?? "GET",
        headers: {
          ...DEFAULT_HEADERS,
          ...(options?.headers ?? {}),
          "X-API-Key": apiKey,
        },
        body: options?.body,
      })

      if (res.ok) {
        try {
          const data = (await res.json()) as T
          return { ok: true, data }
        } catch (e) {
          return { ok: false, status: 500, statusText: "Failed to parse JSON" }
        }
      }

      // Key-scoped failures: try the next key
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        break
      }

      // Retry transient server errors for this key
      if (res.status >= 500 && res.status < 600 && attempt < maxRetriesPerKey) {
        await delay((attempt + 1) * 150)
        continue
      }

      // Non-retryable, non-key-specific error: return immediately
      const errorText = await safeText(res)
      return { ok: false, status: res.status, statusText: res.statusText, errorText }
    }

    // Small delay before trying next key to avoid bursting
    await delay(100)
  }

  return { ok: false, status: 429, statusText: "All Moralis API keys exhausted or rate-limited" }
}

async function safeText(res: Response): Promise<string | undefined> {
  try {
    return await res.text()
  } catch {
    return undefined
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}


