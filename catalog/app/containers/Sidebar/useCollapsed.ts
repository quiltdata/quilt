import * as React from 'react'

export const COLLAPSED_STORAGE_KEY = 'QUILT_SIDEBAR_COLLAPSED'

function read(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    // localStorage may be unavailable; fall through to default
  }
  return false
}

/**
 * Remembers whether the rail is folded to its icon column. A reversible UI
 * preference kept in localStorage so it survives reloads and navigation --
 * not authoritative server state.
 */
export default function useCollapsed() {
  const [collapsed, setCollapsed] = React.useState<boolean>(read)

  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // ignore persistence failures
      }
      return next
    })
  }, [])

  return [collapsed, toggle] as const
}
