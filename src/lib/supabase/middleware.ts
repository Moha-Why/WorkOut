import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Simply pass through - let client-side handle auth
  // This avoids cookie conflicts on mobile browsers
  return NextResponse.next({
    request,
  })
}
