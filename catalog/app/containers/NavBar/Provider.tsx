import * as React from 'react'
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom'

import * as SearchUIModel from 'containers/Search/model'
import * as BucketConfig from 'utils/BucketConfig'
import * as NamedRoutes from 'utils/NamedRoutes'
import parse from 'utils/parseSearch'

import * as Suggestions from './Suggestions/model'

export const expandAnimationDuration = 200

function useUrlQuery() {
  const { paths } = NamedRoutes.use()
  const location = useLocation()
  const match = useRouteMatch(paths.search)
  const qs = match && parse(location.search, true)
  return qs?.q ?? ''
}

function useSearchUIModel() {
  return React.useContext(SearchUIModel.Context)
}

interface SearchState {
  // input: SearchInputProps
  input: $TSFixMe
  onClickAway: () => void
  reset: () => void
  suggestions: ReturnType<typeof Suggestions.use>
}

function useSearchState(bucket?: string): SearchState {
  const history = useHistory()
  const location = useLocation()

  const searchUIModel = useSearchUIModel()

  const query = useUrlQuery()

  const [value, change] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [focusTrigger, setFocusTrigger] = React.useState(0)
  React.useEffect(() => setHelpOpen(false), [location])

  const suggestions = Suggestions.use(value || '', bucket || searchUIModel)

  const onChange = React.useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    change(evt.target.value)
  }, [])

  const handleHelpOpen = React.useCallback(() => {
    setHelpOpen(true)
    suggestions.setSelected(0)
  }, [suggestions])

  const handleExpand = React.useCallback(() => {
    handleHelpOpen()
    if (expanded) return
    change(query)
    setExpanded(true)
  }, [expanded, query, handleHelpOpen])

  const handleCollapse = React.useCallback(() => {
    change(null)
    setExpanded(false)
    setHelpOpen(false)
  }, [])

  const handleHelpClose = React.useCallback(() => setHelpOpen(false), [])

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

  const handleSubmit = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      history.push(suggestions.url)
      handleCollapse()
      event.currentTarget.blur()
    },
    [handleCollapse, history, suggestions],
  )

  const handleEscape = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      handleCollapse()
      event.currentTarget.blur()
    },
    [handleCollapse],
  )

  const handleArrow = React.useCallback(
    (reverse: boolean) => {
      if (helpOpen) {
        suggestions.cycleSelected(reverse)
      } else {
        handleHelpOpen()
      }
    },
    [helpOpen, handleHelpOpen, suggestions],
  )

  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      switch (evt.key) {
        case 'Enter':
          return handleSubmit(evt)
        case 'Tab':
        case 'Escape':
          return handleEscape(evt)
        case 'ArrowDown':
          return handleArrow(false)
        case 'ArrowUp':
          return handleArrow(true)
        default:
          handleHelpOpen()
          break
      }
    },
    [handleSubmit, handleEscape, handleArrow, handleHelpOpen],
  )

  const onClickAway = React.useCallback(() => {
    if (expanded || helpOpen) handleCollapse()
  }, [expanded, helpOpen, handleCollapse])

  const reset = React.useCallback(() => {
    change('')
    setFocusTrigger((n) => n + 1)
  }, [])

  const isExpanded = expanded || !!searchUIModel
  const isSuggestionsOpened = helpOpen && Array.isArray(suggestions.items)
  const focusTriggeredCount = isExpanded ? focusTrigger : 0
  return {
    input: {
      expanded: isExpanded,
      focusTrigger: focusTriggeredCount,
      helpOpen: isSuggestionsOpened,
      onChange,
      onFocus: handleExpand,
      onHelpToggle,
      onKeyDown,
      value: value === null ? query : value,
    },
    reset,
    onClickAway,
    suggestions,
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
