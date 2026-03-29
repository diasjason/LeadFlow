import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(date?: Date | null, includeYear = false): string {
  if (!date) return '-'
  const d = new Date(date)
  // Use UTC methods to avoid timezone-related hydration mismatches
  const day = d.getUTCDate()
  const month = MONTHS[d.getUTCMonth()]
  if (includeYear) {
    return `${day} ${month} ${d.getUTCFullYear()}`
  }
  return `${day} ${month}`
}
