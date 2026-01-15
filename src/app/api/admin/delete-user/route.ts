import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Create Supabase admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This needs to be added to .env.local
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Delete from Supabase Auth (this requires service role key)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return NextResponse.json(
        { error: 'Failed to delete user from authentication', details: authError.message },
        { status: 500 }
      )
    }

    // Profile deletion happens automatically via CASCADE in database
    // or can be done here if needed

    return NextResponse.json(
      { success: true, message: 'User deleted successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
