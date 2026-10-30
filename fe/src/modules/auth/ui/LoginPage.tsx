import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { login, register } from '@/modules/auth/api/authApi'
import { ApiError } from '@/shared/api/client'
import { useSessionStore } from '@/shared/store/sessionStore'
import { Button } from '@/shared/ui/button'

export function LoginPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const canSubmit = username.trim().length > 0 && password.length > 0

  const mutation = useMutation({
    mutationFn: () => (mode === 'login' ? login : register)({ username: username.trim(), password }),
    onSuccess: async (res) => {
      await queryClient.cancelQueries()
      queryClient.clear()
      useSessionStore.getState().setAccessToken(res.accessToken)
      await navigate({ to: '/' })
    },
  })

  const errorMessage = mutation.error instanceof ApiError
    ? mutation.error.status === 409 ? 'Этот ник уже занят.'
      : mutation.error.status === 401 ? 'Неверный ник или пароль.'
      : mutation.error.status === 400 ? 'Введите ник и пароль.'
      : 'Не удалось подключиться. Попробуйте ещё раз.'
    : mutation.error ? 'Не удалось войти. Попробуйте ещё раз.' : null
  const inputClass = 'h-12 w-full rounded-xl border border-white/10 bg-bg-secondary px-4 text-sm outline-none transition focus:border-neon-cyan/60'

  return (
    <form className="flex flex-col gap-5 px-4 py-10" onSubmit={(event) => {
      event.preventDefault()
      if (canSubmit && !mutation.isPending) mutation.mutate()
    }}>
      <h1 className="text-2xl font-semibold text-neon-cyan">{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-text-secondary">Ник</span>
        <input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)}
          autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required
          disabled={mutation.isPending} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-text-secondary">Пароль</span>
        <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required disabled={mutation.isPending} />
      </label>
      {errorMessage ? <div role="alert" className="text-xs text-red-400">{errorMessage}</div> : null}
      <Button type="submit" size="xl" className="h-14 text-base font-semibold" disabled={!canSubmit || mutation.isPending}>
        {mutation.isPending ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
      </Button>
      <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => {
        setMode(mode === 'login' ? 'register' : 'login')
        mutation.reset()
      }}>
        {mode === 'login' ? 'Создать аккаунт' : 'Уже есть аккаунт? Войти'}
      </Button>
    </form>
  )
}
