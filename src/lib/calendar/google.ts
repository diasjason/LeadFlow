// src/lib/calendar/google.ts
// ─────────────────────────────────────────────
// GOOGLE CALENDAR INTEGRATION (REST API)
//
// Creates calendar events for agents when the AI
// voice call books a site visit.
//
// Uses OAuth2 tokens stored per-organization.
// Agent authorizes once during onboarding.
// ─────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

interface CalendarEventParams {
  summary: string         // "Site Visit: Rahul Sharma - 3BHK Whitefield"
  description: string     // Lead details, budget, notes
  startTime: string       // ISO datetime
  endTime: string         // ISO datetime
  attendeeEmail: string   // Agent's email
  organizationId: string  // To fetch stored OAuth tokens
  location?: string
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// ─── Create Calendar Event ──────────────────

export async function createCalendarEvent(
  params: CalendarEventParams
): Promise<string | null> {
  try {
    const accessToken = await getValidAccessToken(params.organizationId)
    if (!accessToken) {
      console.warn('[calendar] No valid access token for org:', params.organizationId)
      return null
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: params.summary,
          description: params.description,
          location: params.location,
          start: { dateTime: params.startTime, timeZone: 'Asia/Kolkata' },
          end: { dateTime: params.endTime, timeZone: 'Asia/Kolkata' },
          attendees: [{ email: params.attendeeEmail }],
          colorId: '10', // Green
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 30 },
            ],
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[calendar] Failed to create event:', err)
      return null
    }

    const data = (await response.json()) as { id?: string }
    return data.id ?? null
  } catch (error) {
    console.error('[calendar] createCalendarEvent error:', error)
    return null
  }
}

// ─── OAuth Token Refresh ─────────────────────

async function getValidAccessToken(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
    },
  })

  if (!org?.googleRefreshToken) return null
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return null

  // Try to refresh the token
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: org.googleRefreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) return null

    const tokens = (await response.json()) as { access_token?: string }
    if (!tokens.access_token) return null

    // Save refreshed access token
    await prisma.organization.update({
      where: { id: organizationId },
      data: { googleAccessToken: tokens.access_token },
    })

    return tokens.access_token
  } catch {
    // Fall back to stored access token if refresh fails
    return org.googleAccessToken ?? null
  }
}

// ─── OAuth Setup (called during onboarding) ──

export function getGoogleAuthUrl(organizationId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: organizationId,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function handleGoogleCallback(
  code: string,
  organizationId: string
): Promise<boolean> {
  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) return false

    const tokens = (await response.json()) as {
      access_token?: string
      refresh_token?: string
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
      },
    })

    return true
  } catch (error) {
    console.error('[calendar] OAuth callback error:', error)
    return false
  }
}
