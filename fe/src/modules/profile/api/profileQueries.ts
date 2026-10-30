import { useQuery } from '@tanstack/react-query'

import { qk } from '@/shared/api/queryKeys'
import { getCurrencies, getMe, getProgression } from './profileApi'

export function useMeQuery() {
  return useQuery({
    queryKey: qk.me(),
    queryFn: getMe,
  })
}

export function useCurrenciesQuery() {
  return useQuery({
    queryKey: qk.currencies(),
    queryFn: getCurrencies,
  })
}

export function useProgressionQuery() {
  return useQuery({
    queryKey: qk.progression(),
    queryFn: getProgression,
  })
}

