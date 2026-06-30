import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

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
