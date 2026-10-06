import { cn } from '@/lib/utils'

export function BrandMark({
  className,
  imgClassName,
  alt = 'Lomiva',
}: {
  className?: string
  imgClassName?: string
  alt?: string
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-sm',
        className,
      )}
    >
      <img
        src="/lomiva-icon.png"
        alt={alt}
        className={cn('size-full object-cover', imgClassName)}
        draggable={false}
      />
    </div>
  )
}
