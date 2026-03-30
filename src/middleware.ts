// src/middleware.ts
// ─────────────────────────────────────────────
// CLERK AUTH MIDDLEWARE
//
// Protects all routes except:
//   - /sign-in, /sign-up (public Clerk pages)
//   - /api/messages/webhook (WhatsApp webhook — verified by token)
//   - /api/vapi/webhook (Vapi webhook — verified by secret)
//   - Static assets
// ─────────────────────────────────────────────

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/messages/webhook(.*)',  // WhatsApp — has its own verify token
  '/api/vapi/webhook(.*)',      // Vapi — has its own secret header
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
