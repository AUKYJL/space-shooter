import { cn } from '@/lib/utils'
import { getResourceIconUrl, type ResourceId } from '@/shared/lib/resources'

type Props = {
  id: ResourceId
  size?: number
  className?: string
}

export function ResourceIcon({ id, size = 16, className }: Props) {
  return (
    <img
      src={getResourceIconUrl(id)}
      alt={id}
      width={size}
      height={size}
      className={cn('inline-block select-none', className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  )
}
