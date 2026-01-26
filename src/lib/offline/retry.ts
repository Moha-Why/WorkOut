/**
 * Exponential backoff retry utility for offline sync
 */

interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onRetry?: (attempt: number, error: Error) => void
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
  // Add jitter (random 0-100% of the delay)
  const jitter = Math.random() * exponentialDelay
  const delay = exponentialDelay + jitter
  // Cap at max delay
  return Math.min(delay, maxDelayMs)
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTIONS, ...options }
  const { onRetry } = options

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs)
        onRetry?.(attempt + 1, lastError)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Sync item with retry - returns success/failure status instead of throwing
 */
export async function syncWithRetry<T>(
  syncFn: () => Promise<T>,
  itemId: string,
  options: RetryOptions = {}
): Promise<{ success: boolean; itemId: string; error?: Error }> {
  try {
    await retryWithBackoff(syncFn, options)
    return { success: true, itemId }
  } catch (error) {
    return {
      success: false,
      itemId,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Batch sync with retry - syncs multiple items with individual retry logic
 */
export async function batchSyncWithRetry<T>(
  items: T[],
  syncFn: (item: T) => Promise<void>,
  getItemId: (item: T) => string,
  options: RetryOptions = {}
): Promise<{
  successful: string[]
  failed: { itemId: string; error: Error }[]
}> {
  const results = await Promise.all(
    items.map((item) =>
      syncWithRetry(() => syncFn(item), getItemId(item), options)
    )
  )

  const successful: string[] = []
  const failed: { itemId: string; error: Error }[] = []

  for (const result of results) {
    if (result.success) {
      successful.push(result.itemId)
    } else if (result.error) {
      failed.push({ itemId: result.itemId, error: result.error })
    }
  }

  return { successful, failed }
}
