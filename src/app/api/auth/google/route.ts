// src/app/api/auth/google/route.ts
// Redirects user to Google OAuth for Calendar access

import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/calendar/google'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  const org = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!org) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  const authUrl = getGoogleAuthUrl(org.id)
  return NextResponse.redirect(authUrl)
}
