import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="mb-6">
            <h1 className="text-6xl font-bold text-text-primary">404</h1>
            <p className="text-xl text-gray-400 mt-2">Page Not Found</p>
          </div>

          <p className="text-gray-500 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>

          <div className="flex flex-col gap-3">
            <Link href="/">
              <Button className="w-full">Go to Home</Button>
            </Link>
            <Link href="/user">
              <Button variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
