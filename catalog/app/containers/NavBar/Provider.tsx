import * as React from 'react'
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom'

import type SearchHelp from 'components/SearchHelp'
import * as BucketConfig from 'utils/BucketConfig'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'

export const expandAnimationDuration = 200

function useSearchUrlState(bucket?: string) {
  const { paths, urls } = NamedRoutes.use()
  const location = useLocation()
  const match = useRouteMatch(paths.search)
  const isInStack = BucketConfig.useIsInStack()
  const settings = CatalogSettings.use()

  const qs = match && parse(location.search, true)

  const query = qs?.q ?? ''
  const mode = qs?.mode ?? settings?.search?.mode
  // if not in stack, search all buckets
  const buckets = qs?.buckets ?? (bucket && isInStack(bucket) ? bucket : undefined)

  const makeUrl = React.useCallback(
    (q: string | null) => urls.search({ q, buckets, mode }),
    [urls, buckets, mode],
  )

  const bucketList = React.useMemo(() => buckets?.split(',') ?? [], [buckets])

  return { query, makeUrl, buckets: bucketList }
}

interface SearchState {
  buckets: string[]
  // input: SearchInputProps
  input: $TSFixMe
  help: Pick<Parameters<typeof SearchHelp>[0], 'open' | 'onQuery'>
  onClickAway: () => void
}

function useSearchState(bucket?: string): SearchState {
  const history = useHistory()

  const { query, makeUrl, buckets } = useSearchUrlState(bucket)

  const [value, change] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)

  const onChange = React.useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    change(evt.target.value)
  }, [])

  const handleExpand = React.useCallback(() => {
    if (expanded) return
    change(query)
    setExpanded(true)
  }, [expanded, query])

  const handleCollapse = React.useCallback(() => {
    change(null)
    setExpanded(false)
    setHelpOpen(false)
  }, [])

  const handleHelpOpen = React.useCallback(() => setHelpOpen(true), [])

  const handleHelpClose = React.useCallback(() => setHelpOpen(false), [])

  const onQuery = React.useCallback(
    (strPart: string) => change((v) => (v ? `${v} ${strPart}` : strPart)),
    [],
  )

  const onHelpToggle = React.useCallback(() => {
    if (helpOpen) {
      handleHelpClose()
      return
    }
    if (expanded) {
      handleHelpOpen()
    } else {
      handleExpand()
      setTimeout(handleHelpOpen, expandAnimationDuration + 100)
    }
  }, [expanded, helpOpen, handleExpand, handleHelpClose, handleHelpOpen])

  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      switch (evt.key) {
        case 'Enter':
          // suppress onSubmit
          evt.preventDefault()
          if (query !== value) {
            history.push(makeUrl(value))
          }
          handleCollapse()
          evt.currentTarget.blur()
          break
        case 'Tab':
        case 'Escape':
          handleCollapse()
          evt.currentTarget.blur()
          break
        case 'ArrowDown':
          handleHelpOpen()
          break
      }
    },
    [history, makeUrl, value, query, handleCollapse, handleHelpOpen],
  )

  const onClickAway = React.useCallback(() => {
    if (expanded || helpOpen) handleCollapse()
  }, [expanded, helpOpen, handleCollapse])

  return {
    buckets,
    input: {
      expanded,
      helpOpen,
      onChange,
      onFocus: handleExpand,
      onHelpToggle,
      onKeyDown,
      value: value === null ? query : value,
    },
    help: {
      onQuery,
      open: helpOpen,
    },
    onClickAway,
  }
}

const Ctx = React.createContext<SearchState | null>(null)

interface ProviderProps {
  children: React.ReactNode
}

export function Provider({ children }: ProviderProps) {
  const bucket = BucketConfig.useCurrentBucket()
  const value = useSearchState(bucket)
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useNavBar = () => React.useContext(Ctx)

export const use = useNavBar
