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
  const canEdit = redux.useSelector(AuthSelectors.isAdmin) as boolean

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
