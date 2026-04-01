// src/app/api/auth/google/callback/route.ts
// Handles Google OAuth callback after user authorizes Calendar access

import { NextRequest, NextResponse } from 'next/server'
import { handleGoogleCallback } from '@/lib/calendar/google'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const organizationId = request.nextUrl.searchParams.get('state')

  if (!code || !organizationId) {
    return NextResponse.redirect(
      new URL('/?error=google_auth_failed', request.url)
    )
  }

  const success = await handleGoogleCallback(code, organizationId)
  const redirectUrl = success ? '/?google=connected' : '/?error=google_auth_failed'

  return NextResponse.redirect(new URL(redirectUrl, request.url))
}
