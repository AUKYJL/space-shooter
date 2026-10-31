import { audioManager } from '@/game/audio/AudioManager'
import type { SfxId } from '@/game/audio/audioCatalog'
import * as React from 'react'
import type { VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/shared/ui/buttonVariants'
import { haptics } from '@/shared/lib/haptics'

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  onClick,
  onClickCapture,
  sfx = 'ui_click',
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    sfx?: SfxId | false
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      onClickCapture={(e) => {
        if (props.disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true') {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        onClickCapture?.(e)
      }}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        if (props.disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true') { e.preventDefault(); return }
        if (onClick) haptics.tap()
        onClick?.(e)
        if (sfx) audioManager.playSfx(sfx)
      }}
      {...props}
    />
  )
}

export { Button }
