import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-white/20 bg-transparent px-3 py-1 text-sm text-white shadow-sm transition-[color,box-shadow] outline-none',
        'placeholder:text-white/40 focus-visible:ring-[3px] focus-visible:ring-amber-500/40',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
