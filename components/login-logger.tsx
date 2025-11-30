'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useRef } from 'react'
import { logUserLogin } from '@/app/actions'

export function LoginLogger() {
  const { user, isLoaded } = useUser()
  const hasLogged = useRef(false)

  useEffect(() => {
    if (isLoaded && user && !hasLogged.current) {
      const email = user.primaryEmailAddress?.emailAddress || 'unknown'
      logUserLogin(user.id, email, user.firstName, user.lastName)
      hasLogged.current = true
    }
  }, [isLoaded, user])

  return null
}
