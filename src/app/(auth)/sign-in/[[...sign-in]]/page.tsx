// src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">LeadFlow CRM</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Sign in to manage your real estate leads
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-lg border border-border bg-card',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              socialButtonsBlockButton:
                'border border-border bg-background hover:bg-accent text-foreground',
              formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90',
              footerActionLink: 'text-primary hover:text-primary/80',
            },
          }}
        />
      </div>
    </div>
  )
}
