import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type LoginDevRequest = { username: string }
export type LoginDevResponse = { accessToken: string }

export function loginDev(body: LoginDevRequest) {
  return requestJson<LoginDevResponse>({
    method: 'POST',
    url: endpoints.auth.loginDev(),
    data: body,
  })
}

