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
  suggestions: ReturnType<typeof Suggestions.use>
}

function useSearchState(bucket?: string): SearchState {
  const history = useHistory()

  const searchUIModel = useSearchUIModel()

  const query = useUrlQuery()

  const [value, change] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)

  const suggestions = Suggestions.use(value || '', bucket || searchUIModel)

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

  const handleHelpOpen = React.useCallback(() => {
    setHelpOpen(true)
    suggestions.setSelected(0)
  }, [suggestions])

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

  return {
    input: {
      expanded: expanded || !!searchUIModel,
      helpOpen,
      onChange,
      onFocus: handleExpand,
      onHelpToggle,
      onKeyDown,
      value: value === null ? query : value,
    },
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
