import { Dashboard } from '@/components/crm/dashboard'
import { Toaster } from '@/components/ui/sonner'

export default function Home() {
  return (
    <>
      <Dashboard />
      <Toaster position="bottom-right" />
    </>
  )
}
