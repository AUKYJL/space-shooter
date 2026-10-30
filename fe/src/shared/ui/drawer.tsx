import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'

import { cn } from '@/lib/utils'

const Drawer = DrawerPrimitive.Root
const DrawerTrigger = DrawerPrimitive.Trigger
const DrawerPortal = DrawerPrimitive.Portal
const DrawerClose = DrawerPrimitive.Close

function DrawerOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>) {
  return <DrawerPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-black/60', className)} {...props} />
}

function DrawerContent({
  className,
  children,
  overlayClassName,
  showHandle = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
  overlayClassName?: string
  showHandle?: boolean
}) {
  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} />
      <DrawerPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-white/10 bg-bg-primary shadow-lg outline-none',
          className,
        )}
        {...props}
      >
        {showHandle ? (
          <div className="mx-auto mt-2 h-1.5 w-14 rounded-full bg-white/15" aria-hidden="true" />
        ) : null}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid gap-1.5 px-4 pt-4', className)} {...props} />
}

function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-auto grid gap-2 p-4', className)} {...props} />
}

function DrawerTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn('text-sm font-semibold', className)} {...props} />
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description className={cn('text-xs text-text-secondary', className)} {...props} />
}

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerClose,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
