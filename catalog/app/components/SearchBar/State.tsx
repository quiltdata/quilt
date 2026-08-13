import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import { useDebouncedCallback } from 'use-debounce'

import { Model as AssistantModel } from 'components/Assistant'

import { classifyQuery } from './classify'
import * as Suggestions from './Suggestions/model'

export const expandAnimationDuration = 200

// A bucket name scopes suggestions to that bucket; a Search UI model reuses the
// live search state; null falls back to global (all-buckets) suggestions.
type SearchContext = Parameters<typeof Suggestions.use>[1]

interface SearchState {
  helpOpen: boolean
  input: Pick<M.InputBaseProps, 'onChange' | 'onFocus' | 'onKeyDown' | 'value'>
  onClickAway: () => void
  suggestions: ReturnType<typeof Suggestions.use>
}

// Matches the debounce the search page's in-body field used for
// search-as-you-type.
const MODEL_UPDATE_DEBOUNCE = 500

export default function useState(context: SearchContext = null): SearchState {
  const history = RRDom.useHistory()

  // Qurator availability + entrypoint. When the assistant is disabled for this
  // stack/user, `assist` is null and `classifyQuery` is told Qurator is off --
  // the bar then behaves exactly as it did before.
  const quratorEnabled = !!AssistantModel.useIsEnabled()
  const assist = AssistantModel.useAssistant()

  // Given a live Search UI model (the search page provides one above its
  // Layout) the bar is bound to it: the value follows the model's URL-held
  // search string and edits are pushed back into the URL (debounced) --
  // the bar IS the page's query input then.
  const model = typeof context === 'string' ? null : context
  const bound = !!model
  const modelSearchString = model ? model.state.searchString || '' : null

  const [value, setValue] = React.useState<string>(modelSearchString ?? '')
  const [helpOpen, setHelpOpen] = React.useState(false)

  const suggestions = Suggestions.use(value, context)

  // Reflect external changes of the URL-held search string (history
  // navigation, suggestion links, reset) into the input.
  React.useEffect(() => {
    if (modelSearchString != null) setValue(modelSearchString)
  }, [modelSearchString])

  const commitToModel = useDebouncedCallback((searchString: string) => {
    model?.actions.setSearchString(searchString)
  }, MODEL_UPDATE_DEBOUNCE)

  const onChange = React.useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setValue(evt.target.value)
      commitToModel(evt.target.value) // no-op when not bound to a model
    },
    [commitToModel],
  )

  const handleHelpOpen = React.useCallback(() => {
    setHelpOpen(true)
    suggestions.setSelected(0)
  }, [suggestions])

  const handleCollapse = React.useCallback(() => {
    // when bound, the value is owned by the model/URL -- keep it
    if (!bound) setValue('')
    setHelpOpen(false)
  }, [bound])

  const handleSubmit = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      // the chosen suggestion URL wins over a pending debounced model update
      commitToModel.cancel()
      // Route natural-language queries to Qurator, keyword queries to search.
      // Only the default suggestion (index 0 -- "search for this text") may be
      // superseded this way: once the user has arrowed to a specific
      // destination, Enter means that destination, never the assistant.
      // Falls back to search whenever Qurator can't take it (disabled, or no
      // `assist` entrypoint available).
      if (
        assist &&
        suggestions.selected === 0 &&
        classifyQuery(value, quratorEnabled) === 'Qurator'
      ) {
        assist(value.trim())
      } else {
        history.push(suggestions.url)
      }
      handleCollapse()
      // when bound, the bar is the search page's query input -- keep focus
      // so the user can carry on typing in place
      if (!bound) event.currentTarget.blur()
    },
    [
      assist,
      bound,
      commitToModel,
      handleCollapse,
      history,
      quratorEnabled,
      suggestions,
      value,
    ],
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
    if (helpOpen) handleCollapse()
  }, [helpOpen, handleCollapse])

  return {
    input: {
      onChange,
      // when bound, the input is focused on mount (autoFocus), so opening the
      // dropdown is deferred until the user actually types or presses arrows
      onFocus: bound ? undefined : handleHelpOpen,
      onKeyDown,
      value,
    },
    helpOpen,
    onClickAway,
    suggestions,
  }
}
