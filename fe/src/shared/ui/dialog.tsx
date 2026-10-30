import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

type DialogOverlayProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>

export const DialogOverlay = ({ className, ...props }: DialogOverlayProps) => {
  return <DialogPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/60', className)} {...props} />
}

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>

export const DialogContent = ({ className, children, ...props }: DialogContentProps) => {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-bg-primary shadow-lg outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement>

export const DialogHeader = ({ className, ...props }: DialogHeaderProps) => {
  return <div className={cn('grid gap-1.5 px-4 pt-4', className)} {...props} />
}

type DialogFooterProps = React.HTMLAttributes<HTMLDivElement>

export const DialogFooter = ({ className, ...props }: DialogFooterProps) => {
  return <div className={cn('grid gap-2 px-4 pb-4 pt-4', className)} {...props} />
}

type DialogTitleProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>

export const DialogTitle = ({ className, ...props }: DialogTitleProps) => {
  return <DialogPrimitive.Title className={cn('text-sm font-semibold', className)} {...props} />
}

type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>

export const DialogDescription = ({ className, ...props }: DialogDescriptionProps) => {
  return <DialogPrimitive.Description className={cn('text-xs text-text-secondary', className)} {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
}
