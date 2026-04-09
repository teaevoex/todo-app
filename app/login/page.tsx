'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { LoginForm } from '@/components/auth/LoginForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  function handleSuccess() {
    router.push('/')
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    )
  }

  return (
    <main
      data-testid="login-page"
      className="flex min-h-screen items-center justify-center bg-background p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-md border border-border">
        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">
          Todo App
        </h1>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" data-testid="tab-login">
              Login
            </TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">
              Register
            </TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginForm onSuccess={handleSuccess} />
          </TabsContent>
          <TabsContent value="register">
            <RegisterForm onSuccess={handleSuccess} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
