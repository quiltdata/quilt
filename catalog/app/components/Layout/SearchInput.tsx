import * as React from 'react'

// The app's query input lives in the header band (ContentBar), not in the page
// body: pages that used to mount their own search field no longer have one to
// hold a ref to. This carries a handle to the header field down to them, so
// affordances like the empty-results screen's "edit your search query" and
// "start from scratch" can still focus and select it.
//
// Deliberately a ref rather than state: the identity is stable, so consumers'
// `useCallback` deps don't churn when the field mounts.

const Ctx = React.createContext<React.MutableRefObject<HTMLInputElement | null> | null>(
  null,
)

interface SearchInputProviderProps {
  children: React.ReactNode
}

export function SearchInputProvider({ children }: SearchInputProviderProps) {
  const ref = React.useRef<HTMLInputElement | null>(null)
  return <Ctx.Provider value={ref}>{children}</Ctx.Provider>
}

// For the header bar: the ref to attach to the query field. Null outside a
// provider, so the bar keeps working when rendered on its own (e.g. in a test).
export function useSearchInputRef() {
  return React.useContext(Ctx)
}

// For pages: focus/select the header query field. Both no-op when there is no
// field to reach -- a page under a `bare` layout, or before the bar mounts --
// so callers don't have to guard.
export function useSearchInput() {
  const ref = React.useContext(Ctx)
  return React.useMemo(
    () => ({
      focus: () => ref?.current?.focus(),
      select: () => ref?.current?.select(),
    }),
    [ref],
  )
}
