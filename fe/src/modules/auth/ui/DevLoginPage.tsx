import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { loginDev } from '@/modules/auth/api/authApi'
import { ApiError } from '@/shared/api/client'
import { useSessionStore } from '@/shared/store/sessionStore'
import { Button } from '@/shared/ui/button'

export function DevLoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [touched, setTouched] = useState(false)

  const canSubmit = useMemo(() => username.trim().length > 0, [username])

  const loginMutation = useMutation({
    mutationFn: () => loginDev({ username: username.trim() }),
    onSuccess: async (res) => {
      useSessionStore.getState().setAccessToken(res.accessToken)
      await queryClient.invalidateQueries()
      await navigate({ to: '/' })
    },
  })

  const errorMessage = useMemo(() => {
    const err = loginMutation.error
    if (!err) return null
    if (err instanceof ApiError) return err.message
    if (err instanceof Error) return err.message
    return 'Login failed'
  }, [loginMutation.error])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-2xl font-semibold text-neon-cyan">Dev Login</div>
        <div className="mt-1 text-xs text-text-secondary">Dev-only auth. Enter any username.</div>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-text-secondary">Username</span>
        <input
          className={[
            'h-12 w-full rounded-xl border bg-bg-secondary px-4 text-sm outline-none transition',
            touched && !canSubmit ? 'border-red-500/60' : 'border-white/10 focus:border-neon-cyan/60',
          ].join(' ')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="commander"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
        />
      </label>

      {errorMessage ? <div className="text-xs text-red-400">{errorMessage}</div> : null}

      <Button
        size="xl"
        className="h-14 text-base font-semibold"
        disabled={!canSubmit || loginMutation.isPending}
        onClick={() => {
          setTouched(true)
          if (!canSubmit) return
          loginMutation.mutate()
        }}
      >
        {loginMutation.isPending ? 'Logging in…' : 'Login'}
      </Button>
    </div>
  )
}

