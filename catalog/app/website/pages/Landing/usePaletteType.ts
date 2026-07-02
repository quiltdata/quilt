import * as React from 'react'

const PALETTE_STORAGE_KEY = 'QUILT_FRONT_DOOR_PALETTE'

// Shared light/dark preference for the signed-in "website" surfaces (front
// door + volumes). Light is the design default; dark is an explicit opt-in
// persisted in localStorage.
export default function usePaletteType() {
  const [type, setType] = React.useState<'light' | 'dark'>(() => {
    try {
      const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY)
      return stored === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const toggle = React.useCallback(() => {
    setType((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(PALETTE_STORAGE_KEY, next)
      } catch {
        // best-effort persistence only
      }
      return next
    })
  }, [])
  return { type, toggle }
}
