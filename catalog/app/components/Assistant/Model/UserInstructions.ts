import * as React from 'react'

import * as XML from 'utils/XML'

/**
 * Sticky pre-query instructions ("Qurator config"): free-text guidance the
 * user pins above the composer. Persisted in localStorage so it survives
 * reloads and navigation — a reversible UI preference, not authoritative
 * server state. When active, the text is injected into the prompt as a
 * visible `<user-instructions>` block through the regular Assistant context
 * aggregation (see `Assistant.tsx`), so it is inspectable in DevTools like
 * any other context contribution rather than a silent system string.
 */

export const STORAGE_KEY = 'qurator.userInstructions'

/**
 * The mute flag lives under its own key so disabling never destroys the
 * text: `qurator.userInstructions` always holds exactly what the user wrote.
 * Absent means enabled — instructions are on by default once written.
 */
export const ENABLED_STORAGE_KEY = 'qurator.userInstructions.enabled'

export function readText(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    // localStorage may be unavailable; fall through to default
  }
  return ''
}

export function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_STORAGE_KEY) !== '0'
  } catch {
    // localStorage may be unavailable; fall through to default
  }
  return true
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // ignore persistence failures; in-memory state still works this session
  }
}

/**
 * Render the instructions as a prompt block. A dedicated top-level tag (not
 * prose smuggled into another message) so the model can attribute it: these
 * are the user's standing instructions for the whole conversation, distinct
 * from the current question.
 */
export const toPromptBlock = (text: string) =>
  XML.tag(
    'user-instructions',
    {},
    'The user has configured the following standing instructions.',
    'Apply them to every response in this conversation:',
    text,
  ).toString()

export interface UserInstructions {
  /** The raw instructions text as the user wrote it. */
  text: string
  setText: (text: string) => void
  /** Muting keeps the text but stops injecting it. */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  clear: () => void
  /** True when non-empty and enabled, i.e. injected into prompts. */
  active: boolean
}

export function useUserInstructions(): UserInstructions {
  const [text, setTextState] = React.useState(readText)
  const [enabled, setEnabledState] = React.useState(readEnabled)

  const setText = React.useCallback((next: string) => {
    setTextState(next)
    write(STORAGE_KEY, next || null)
  }, [])

  const setEnabled = React.useCallback((next: boolean) => {
    setEnabledState(next)
    write(ENABLED_STORAGE_KEY, next ? null : '0')
  }, [])

  const clear = React.useCallback(() => setText(''), [setText])

  const active = enabled && !!text.trim()

  return React.useMemo(
    () => ({ text, setText, enabled, setEnabled, clear, active }),
    [text, setText, enabled, setEnabled, clear, active],
  )
}
