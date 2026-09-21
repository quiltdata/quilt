import * as Sentry from '@sentry/react'
import * as React from 'react'
import * as redux from 'react-redux'

import * as AuthSelectors from 'containers/Auth/selectors'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as XML from 'utils/XML'

/**
 * Stack-wide standing instructions ("Qurator config"): free-text guidance
 * that rides along with every prompt for everyone on the stack. Persisted in
 * `CatalogSettings` (`catalog/settings.json` in the service bucket) so one
 * steer covers the whole deployment. Only admins write; every user receives
 * the injection. When active, the text lands in the prompt as a visible
 * `<user-instructions>` block through the regular Assistant context
 * aggregation (see `Assistant.tsx`), so it is inspectable in DevTools like
 * any other context contribution rather than a silent system string.
 */

/**
 * Render the instructions as a prompt block. A dedicated top-level tag (not
 * prose smuggled into another message) so the model can attribute it: these
 * are the stack's standing instructions for the whole conversation, distinct
 * from the current question.
 */
export const toPromptBlock = (text: string) =>
  XML.tag(
    'user-instructions',
    {},
    'The stack administrator has configured the following standing instructions.',
    'Apply them to every response in this conversation:',
    text,
  ).toString()

export interface UserInstructions {
  /** The raw instructions text as written. */
  text: string
  /** Writes hit the stack settings; rejects with `SettingsConflictError` on a stale read. */
  setText: (text: string) => Promise<void>
  /** Muting keeps the text but stops injecting it. */
  enabled: boolean
  setEnabled: (enabled: boolean) => Promise<void>
  clear: () => Promise<void>
  /** True when non-empty and enabled, i.e. injected into prompts. */
  active: boolean
  /** Admins only; the same population as Admin → Settings. */
  canEdit: boolean
}

export function useUserInstructions(): UserInstructions {
  const settings = CatalogSettings.use()
  const writeSettings = CatalogSettings.useWriteSettings()
  const canEdit = !!redux.useSelector(AuthSelectors.isAdmin)

  const text = settings?.qurator?.instructions ?? ''
  const enabled = settings?.qurator?.instructionsEnabled !== false

  const write = React.useCallback(
    (patch: NonNullable<CatalogSettings.CatalogSettings['qurator']>) =>
      canEdit
        ? writeSettings(
            { ...settings, qurator: { ...settings?.qurator, ...patch } },
            settings,
          )
        : Promise.reject(new Error('Only admins can change Qurator instructions')),
    [canEdit, settings, writeSettings],
  )

  const setText = React.useCallback(
    (next: string) => write({ instructions: next }),
    [write],
  )
  const setEnabled = React.useCallback(
    (next: boolean) => write({ instructionsEnabled: next }),
    [write],
  )
  const clear = React.useCallback(() => setText(''), [setText])

  const active = enabled && !!text.trim()

  return React.useMemo(
    () => ({ text, setText, enabled, setEnabled, clear, active, canEdit }),
    [text, setText, enabled, setEnabled, clear, active, canEdit],
  )
}

const errorMessage = (e: unknown) =>
  e instanceof CatalogSettings.SettingsConflictError
    ? e.message
    : "Couldn't save instructions, see console for details"

/**
 * Editor state shared by the in-chat strip and Admin → Settings: a local draft
 * (so typing does not PUT settings.json per keystroke), one in-flight write
 * at a time, and the failure surfaced inline. Both surfaces render the same
 * stack value, so the draft is dropped whenever it moves underneath.
 */
export function useInstructionsEditor(instructions: UserInstructions) {
  const { text, setText, setEnabled, clear } = instructions

  const [draft, setDraft] = React.useState(text)
  React.useEffect(() => setDraft(text), [text])

  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const mounted = React.useRef(true)
  React.useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  const run = React.useCallback(async (op: () => Promise<void>) => {
    setPending(true)
    setError(null)
    try {
      await op()
    } catch (e) {
      Sentry.captureException(e)
      // eslint-disable-next-line no-console
      console.error('Error saving Qurator instructions', e)
      if (mounted.current) setError(errorMessage(e))
    } finally {
      if (mounted.current) setPending(false)
    }
  }, [])

  const save = React.useCallback(() => run(() => setText(draft)), [run, setText, draft])
  const toggle = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.checked
      run(() => setEnabled(next))
    },
    [run, setEnabled],
  )
  // Clearing an unsaved draft is local; only a stored value costs a write.
  const onClear = React.useCallback(() => {
    setDraft('')
    if (text) run(clear)
  }, [run, clear, text])

  return { draft, setDraft, dirty: draft !== text, pending, error, save, toggle, onClear }
}
