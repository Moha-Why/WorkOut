'use client'

import { useEffect } from 'react'
import { Card, CardContent } from './Card'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  isOpen: boolean
  onClose: () => void
  duration?: number
}

export function Toast({
  message,
  type = 'success',
  isOpen,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  const bgColors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  }

  const icons = {
    success: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    error: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    info: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <Card className={`${bgColors[type]} border-none shadow-lg min-w-[300px]`}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-white">
            {icons[type]}
            <p className="flex-1 font-medium">{message}</p>
            <button
              onClick={onClose}
              className="hover:opacity-70 transition-opacity"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
