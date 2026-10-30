import { cn } from '@/lib/utils'
import type { ResourceId } from '@/shared/lib/resources'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'

type Props = {
  id: ResourceId
  amount: number
  className?: string
}

export function ResourceAmount({ id, amount, className }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <ResourceIcon id={id} size={14} />
      <span>{amount.toLocaleString()}</span>
    </span>
  )
}
