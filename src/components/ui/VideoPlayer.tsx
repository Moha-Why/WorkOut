'use client'

import { useEffect, useRef, useState } from 'react'
import { VideoProvider } from '@/types'
import { getVideoEmbedUrl } from '@/lib/utils/video'

interface VideoPlayerProps {
  provider: VideoProvider
  videoId: string
  autoplay?: boolean
  controls?: boolean
  className?: string
  onReady?: () => void
  onEnd?: () => void
}

export function VideoPlayer({
  provider,
  videoId,
  autoplay = false,
  controls = true,
  className = '',
  onReady,
  onEnd,
}: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const embedUrl = getVideoEmbedUrl(provider, videoId)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
  }, [videoId, provider])

  const handleLoad = () => {
    setIsLoading(false)
    onReady?.()
  }

  const handleError = () => {
    setIsLoading(false)
    setError('Failed to load video')
  }

  if (!embedUrl) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg p-8">
        <p className="text-red-600">Invalid video URL</p>
      </div>
    )
  }

  return (
    <div className={`relative w-full ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-black" />
            <p className="text-sm text-gray-600">Loading video...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="Exercise Video"
        className="w-full aspect-video rounded-lg"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
