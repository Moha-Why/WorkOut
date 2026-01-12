import { VideoProvider } from '@/types'

// Get embed URL for video provider
export function getVideoEmbedUrl(
  provider: VideoProvider,
  videoId: string
): string {
  switch (provider) {
    case 'youtube':
      return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`
    case 'vimeo':
      return `https://player.vimeo.com/video/${videoId}?autoplay=0`
    case 'custom':
      return videoId // Assume custom is a direct URL
    default:
      return ''
  }
}

// Get thumbnail URL
export function getVideoThumbnail(
  provider: VideoProvider,
  videoId: string
): string {
  switch (provider) {
    case 'youtube':
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    case 'vimeo':
      // Vimeo requires API call for thumbnail, using placeholder
      return `https://vumbnail.com/${videoId}.jpg`
    case 'custom':
      return '/placeholder-video.jpg'
    default:
      return '/placeholder-video.jpg'
  }
}

// Extract video ID from URL
export function extractVideoId(
  url: string,
  provider: VideoProvider
): string | null {
  try {
    if (provider === 'youtube') {
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
        /youtube\.com\/embed\/([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/,
      ]
      for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
      }
    } else if (provider === 'vimeo') {
      const pattern = /vimeo\.com\/(?:video\/)?(\d+)/
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  } catch {
    return null
  }
}

// Validate video URL
export function isValidVideoUrl(url: string, provider: VideoProvider): boolean {
  if (provider === 'custom') {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
  return extractVideoId(url, provider) !== null
}

// Format video duration (seconds to MM:SS)
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
