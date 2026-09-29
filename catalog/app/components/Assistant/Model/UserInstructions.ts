import * as Sentry from '@sentry/react'
import * as React from 'react'
import * as redux from 'react-redux'

import * as AuthSelectors from 'containers/Auth/selectors'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as XML from 'utils/XML'

/**
 * Standing instructions that ride along with every Qurator prompt, in two
 * independent layers:
 *
 * - **Global** — one steer for the whole deployment, persisted in
 *   `CatalogSettings` (`catalog/settings.json` in the service bucket). Admins
 *   write; every user receives the injection.
 * - **Personal** — the signed-in user's own notes for their own work, in
 *   `localStorage`: a reversible browser preference, nobody else's business.
 *
 * Both are independent: muting or clearing one leaves the other untouched.
 * When active, each lands in the prompt as its own visible block through the
 * regular Assistant context aggregation (see `Assistant.tsx`), so they are
 * inspectable in DevTools like any other context contribution rather than a
 * silent system string.
 */

/**
 * Base keys are #5310's, so notes written before the global layer landed come
 * back rather than reading as lost. The mute flag lives under its own key:
 * muting never destroys the text.
 */
export const PERSONAL_STORAGE_KEY = 'qurator.userInstructions'
/** Absent means enabled — notes are on by default once written. */
export const PERSONAL_ENABLED_STORAGE_KEY = 'qurator.userInstructions.enabled'

/**
 * Sign-out clears only `user` and `tokens`, so an unscoped key would hand the
 * next account in this browser the previous user's notes — and inject them into
 * their prompts. Scoping by username keeps each account's notes to itself.
 * Signed out there is no owner, so nothing is read or written.
 */
const scopeKey = (key: string, username: string) => `${key}:${username}`

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    // localStorage may be unavailable (private mode, blocked storage)
    return null
  }
}

function writeLocal(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // ignore persistence failures; in-memory state still works this session
  }
}

/**
 * Notes written before keys were scoped belong to whoever was signed in then,
 * and nothing recorded who that was — so they cannot be migrated to an owner,
 * and leaving them would keep one user's text sitting in the next user's
 * browser. Dropped rather than adopted.
 */
export function dropUnscopedPersonal() {
  writeLocal(PERSONAL_STORAGE_KEY, null)
  writeLocal(PERSONAL_ENABLED_STORAGE_KEY, null)
}

export const readPersonalText = (username: string) =>
  username ? readLocal(scopeKey(PERSONAL_STORAGE_KEY, username)) || '' : ''
export const readPersonalEnabled = (username: string) =>
  !username || readLocal(scopeKey(PERSONAL_ENABLED_STORAGE_KEY, username)) !== '0'

/**
 * Render a layer as a prompt block. Dedicated top-level tags (not prose
 * smuggled into another message) so the model can attribute each one: whose
 * standing instructions these are, distinct from each other and from the
 * current question.
 */
export const toPromptBlock = (text: string) =>
  XML.tag(
    'user-instructions',
    {},
    'The stack administrator has configured the following standing instructions.',
    'Apply them to every response in this conversation:',
    text,
  ).toString()

export const toPersonalPromptBlock = (text: string) =>
  XML.tag(
    'personal-instructions',
    {},
    'The user has configured the following personal instructions for their own work.',
    'Apply them to every response in this conversation:',
    text,
  ).toString()

/** One layer's state and controls. Both layers share this shape so the strip
 * and the editor hook are written once. */
export interface Instructions {
  /** The raw instructions text as written. */
  text: string
  setText: (text: string) => Promise<void>
  /** Muting keeps the text but stops injecting it. */
  enabled: boolean
  setEnabled: (enabled: boolean) => Promise<void>
  clear: () => Promise<void>
  /** True when non-empty and enabled, i.e. injected into prompts. */
  active: boolean
  /** Global: admins only. Personal: always the user's own. */
  canEdit: boolean
}

/** The two layers, as handed to the UI. */
export interface DualInstructions {
  global: Instructions
  personal: Instructions
}

/** Stack-wide layer: `CatalogSettings`, admin-writable, everyone receives it. */
export function useGlobalInstructions(): Instructions {
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
        : Promise.reject(new Error('Only admins can change global Qurator instructions')),
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

/**
 * Personal layer: this browser's `localStorage`. Async setters (the writes are
 * synchronous) only so both layers share `useInstructionsEditor`.
 */
export function usePersonalInstructions(): Instructions {
  const username: string = redux.useSelector(AuthSelectors.username) || ''
  const [text, setTextState] = React.useState(() => readPersonalText(username))
  const [enabled, setEnabledState] = React.useState(() => readPersonalEnabled(username))

  React.useEffect(dropUnscopedPersonal, [])

  // Signing in or switching account under a live panel must swap the notes with
  // it, not carry the previous owner's into the new session.
  React.useEffect(() => {
    setTextState(readPersonalText(username))
    setEnabledState(readPersonalEnabled(username))
  }, [username])

  const setText = React.useCallback(
    async (next: string) => {
      setTextState(next)
      if (username) writeLocal(scopeKey(PERSONAL_STORAGE_KEY, username), next || null)
    },
    [username],
  )

  const setEnabled = React.useCallback(
    async (next: boolean) => {
      setEnabledState(next)
      if (username)
        writeLocal(scopeKey(PERSONAL_ENABLED_STORAGE_KEY, username), next ? null : '0')
    },
    [username],
  )

  const clear = React.useCallback(() => setText(''), [setText])

  const active = enabled && !!text.trim()

  return React.useMemo(
    () => ({ text, setText, enabled, setEnabled, clear, active, canEdit: true }),
    [text, setText, enabled, setEnabled, clear, active],
  )
}

const errorMessage = (e: unknown) =>
  e instanceof CatalogSettings.SettingsConflictError
    ? e.message
    : "Couldn't save instructions, see console for details"

/**
 * Editor state for one layer, shared by the in-chat strip and Admin →
 * Settings: a local draft (so typing does not PUT settings.json per
 * keystroke), one in-flight write at a time, and the failure surfaced inline.
 * The draft is dropped whenever the stored value moves underneath.
 */
export function useInstructionsEditor(instructions: Instructions) {
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
