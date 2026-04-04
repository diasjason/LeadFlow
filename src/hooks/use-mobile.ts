import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

function getIsMobile(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener('change', onStoreChange)
  window.addEventListener('resize', onStoreChange)
  return () => {
    mql.removeEventListener('change', onStoreChange)
    window.removeEventListener('resize', onStoreChange)
  }
}

/**
 * Mobile layout flag. Uses useSyncExternalStore so SSR + first client paint
 * both use `false` (desktop), then the client updates after mount — no hydration mismatch.
 */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    getIsMobile,
    () => false
  )
}
