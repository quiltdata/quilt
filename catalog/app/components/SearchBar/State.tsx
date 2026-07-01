import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import { Model as AssistantModel } from 'components/Assistant'

import { classifyQuery } from './classify'
import * as Suggestions from './Suggestions/model'

export const expandAnimationDuration = 200

interface SearchState {
  helpOpen: boolean
  input: Pick<M.InputBaseProps, 'onChange' | 'onFocus' | 'onKeyDown' | 'value'>
  onClickAway: () => void
  suggestions: ReturnType<typeof Suggestions.use>
}

export default function useState(): SearchState {
  const history = RRDom.useHistory()

  // Qurator availability + entrypoint. When the assistant is disabled for this
  // stack/user, `assist` is undefined and `classifyQuery` is told Qurator is
  // off, so every submit falls back to catalog search — no behavior change.
  const quratorEnabled = !!AssistantModel.useIsEnabled()
  const assist = AssistantModel.useAssistant()

  const [value, setValue] = React.useState<string>('')
  const [helpOpen, setHelpOpen] = React.useState(false)

  const suggestions = Suggestions.use(value)

  const onChange = React.useCallback((evt: React.ChangeEvent<HTMLInputElement>) => {
    setValue(evt.target.value)
  }, [])

  const handleHelpOpen = React.useCallback(() => {
    setHelpOpen(true)
    suggestions.setSelected(0)
  }, [suggestions])

  const handleCollapse = React.useCallback(() => {
    setValue('')
    setHelpOpen(false)
  }, [])

  const handleSubmit = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.preventDefault()
      // Route natural-language queries to Qurator, keyword queries to search.
      // Falls back to search when Qurator can't take it (disabled, or no
      // `assist` entrypoint available).
      if (assist && classifyQuery(value, quratorEnabled) === 'Qurator') {
        assist(value.trim())
      } else {
        history.push(suggestions.url)
      }
      handleCollapse()
      event.currentTarget.blur()
    },
    [assist, handleCollapse, history, quratorEnabled, suggestions, value],
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
      onFocus: handleHelpOpen,
      onKeyDown,
      value,
    },
    helpOpen,
    onClickAway,
    suggestions,
  }
}
