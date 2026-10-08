import * as M from '@material-ui/core'
import * as React from 'react'

import type * as Types from 'utils/types'

import type { SuggestState } from '../State/metaSuggest'

/*
 * The two AI-suggestion slots the metadata form renders (AI-SUGGESTIONS-CONTRACT.md §0).
 * The form only places them; what they show is the suggestion seat's to change.
 */

const display = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))

const useSuggestBarStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.background.default,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.secondary,
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1, 1.5),
    marginBottom: t.spacing(2),
    minHeight: 52,
    padding: t.spacing(1, 1, 1, 1.5),
  },
  icon: {
    color: t.palette.text.secondary,
  },
  text: {
    flex: '1 1 220px',
    minWidth: 0,
  },
  actions: {
    display: 'flex',
    gap: t.spacing(0.5),
    marginLeft: 'auto',
  },
}))

export interface SuggestBarProps {
  disabled: boolean
  onRequest: () => void
  onUseAll: () => void
  state: SuggestState
  /** Suggestions still offered beside their fields. */
  usable: number
  /** Of those, what Use all would apply: gaps and broken values, not valid replacements. */
  fillable: number
}

export function SuggestBar({
  disabled,
  fillable,
  onRequest,
  onUseAll,
  state,
  usable,
}: SuggestBarProps) {
  const classes = useSuggestBarStyles()
  if (state._tag === 'unavailable') return null
  const icon = (
    <M.Icon className={classes.icon} fontSize="small" aria-hidden>
      auto_awesome
    </M.Icon>
  )
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  switch (state._tag) {
    case 'idle':
      return (
        <div className={classes.root}>
          {icon}
          <span className={classes.text}>
            Fill fields from similar packages you can read and the files being added.
          </span>
          <div className={classes.actions}>
            <M.Button
              color="primary"
              disabled={disabled}
              onClick={onRequest}
              size="small"
              variant="outlined"
            >
              Suggest values
            </M.Button>
          </div>
        </div>
      )
    case 'loading':
      return (
        <div className={classes.root} role="status">
          <M.CircularProgress size={18} />
          <span className={classes.text}>Reading similar packages…</span>
        </div>
      )
    case 'error':
      return (
        <div className={classes.root} role="alert">
          <M.Icon className={classes.icon} fontSize="small" aria-hidden>
            error_outline
          </M.Icon>
          <span className={classes.text}>Couldn't get suggestions. {state.message}</span>
          <div className={classes.actions}>
            <M.Button disabled={disabled} onClick={onRequest} size="small">
              Try again
            </M.Button>
          </div>
        </div>
      )
    case 'ready': {
      // later edits can rule suggestions out; count only those still offered
      const n = usable
      return (
        <div className={classes.root} role="status">
          {icon}
          <span className={classes.text}>
            {n
              ? `${plural(n, 'suggestion')} from ${plural(state.examples, 'similar package')}. Review each before using it.`
              : state.examples
                ? `No suggestions: ${plural(state.examples, 'similar package')} gave no clear values.`
                : 'No suggestions: there are no earlier packages with this workflow to learn from yet.'}
          </span>
          <div className={classes.actions}>
            <M.Button disabled={disabled} onClick={onRequest} size="small">
              Refresh
            </M.Button>
            {!!fillable && (
              <M.Button
                color="primary"
                disableElevation
                disabled={disabled}
                onClick={onUseAll}
                size="small"
                variant="contained"
              >
                Use all
              </M.Button>
            )}
          </div>
        </div>
      )
    }
  }
}

const useFieldRowStyles = M.makeStyles((t) => ({
  suggestion: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.background.paper,
    border: `1px dashed ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.primary,
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(1),
    marginTop: t.spacing(0.5),
    minHeight: 36,
    padding: t.spacing(0, 0.5, 0, 1.5),
    textAlign: 'left',
    transition: 'border-color 150ms ease-out, background-color 150ms ease-out',
    width: '100%',
    '&:hover': {
      background: t.palette.action.hover,
      borderColor: t.palette.text.secondary,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  suggestionIcon: {
    color: t.palette.text.secondary,
    fontSize: 16,
  },
  suggestionValue: {
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  suggestionUse: {
    ...t.typography.button,
    color: t.palette.primary.main,
    fontSize: 12,
    padding: t.spacing(0.5, 1),
  },
}))

export interface SuggestFieldRowProps {
  disabled: boolean
  /** id of the field's input, so Use can return focus to it. */
  fieldId: string
  label: string
  name: string
  onUse: (key: string, value: Types.Json) => void
  suggestion?: { value: Types.Json; reason?: string }
  value: Types.Json | undefined
}

/** Field slot: one row under a field's input, above its helper text. */
export function SuggestFieldRow({
  disabled,
  fieldId,
  label,
  name,
  onUse,
  suggestion,
  value,
}: SuggestFieldRowProps) {
  const classes = useFieldRowStyles()
  // by value, not text: the string "1" fixes a field where the number 1 is wrong
  if (
    !suggestion ||
    disabled ||
    JSON.stringify(suggestion.value) === JSON.stringify(value)
  )
    return null
  return (
    <button
      type="button"
      className={classes.suggestion}
      onClick={() => {
        onUse(name, suggestion.value)
        // the button goes away once used; keep focus on the field it filled
        window.setTimeout(() => document.getElementById(fieldId)?.focus())
      }}
      title={suggestion.reason ? `AI suggestion: ${suggestion.reason}` : 'AI suggestion'}
      aria-label={`Use suggested ${label}: ${display(suggestion.value)}`}
      aria-describedby={suggestion.reason ? `${fieldId}-reason` : undefined}
    >
      {suggestion.reason && (
        <span id={`${fieldId}-reason`} hidden>
          {suggestion.reason}
        </span>
      )}
      <M.Icon className={classes.suggestionIcon} aria-hidden>
        auto_awesome
      </M.Icon>
      <span className={classes.suggestionValue}>{display(suggestion.value)}</span>
      <span className={classes.suggestionUse}>Use</span>
    </button>
  )
}
