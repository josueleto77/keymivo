import { MapPin } from 'lucide-react'
import * as React from 'react'
import { Input } from '@/components/ui/input'
import { mapsEnabled, newSessionToken, resolveAddress, suggestAddresses, type AddressSuggestion, type ResolvedAddress } from '@/lib/maps'

/** Street address input with Google Places suggestions; falls back to a plain input without a Maps key. */
export const AddressAutocomplete = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { onResolved: (a: ResolvedAddress) => void }
>(({ onResolved, onChange, ...props }, ref) => {
  const [items, setItems] = React.useState<AddressSuggestion[]>([])
  const [open, setOpen] = React.useState(false)
  const token = React.useRef<unknown>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  if (!mapsEnabled()) return <Input ref={ref} onChange={onChange} {...props} />

  function query(text: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        token.current ??= await newSessionToken()
        const s = await suggestAddresses(text, token.current)
        setItems(s)
        setOpen(s.length > 0)
      } catch {
        setOpen(false)
      }
    }, 250)
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        autoComplete="off"
        {...props}
        onChange={(e) => { onChange?.(e); query(e.target.value) }}
        onBlur={(e) => { props.onBlur?.(e); setTimeout(() => setOpen(false), 150) }}
      />
      {open && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border bg-card shadow-lift" role="listbox">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-subtle"
                onMouseDown={async (e) => {
                  e.preventDefault()
                  setOpen(false)
                  const a = await resolveAddress(s.prediction)
                  token.current = null // a session ends with a details request
                  onResolved(a)
                }}
              >
                <MapPin className="size-4 shrink-0 text-muted" /> {s.text}
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-right text-[10px] text-muted">Powered by Google</li>
        </ul>
      )}
    </div>
  )
})
AddressAutocomplete.displayName = 'AddressAutocomplete'
