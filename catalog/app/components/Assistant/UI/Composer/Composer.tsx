import cx from 'classnames'
import * as React from 'react'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import * as authSelectors from 'containers/Auth/selectors'
import * as Actor from 'utils/Actor'
import { runtime } from 'utils/Effect'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useFeature } from 'utils/features'
import useId from 'utils/useId'

import type * as Model from '../../Model'
import * as Connectors from '../../Model/Connectors'
import * as ModelChoice from '../../Model/ModelChoice'
import { NAME_TAKEN, type SessionSave } from '../../Model/SessionSave'
import { title as toolTitle } from '../../Model/Tool'
import { darkTheme } from '../Chat/Input'
import Instructions from '../Chat/Instructions'

/** The slice of the assistant the composer reads; hosts pass the whole API. */
export type ComposerAPI = Pick<
  Model.Assistant.API,
  'model' | 'connectors' | 'instructions' | 'mode' | 'setMode'
>
type API = ComposerAPI

const PLATFORM = 'platform'

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: '0 auto',
    maxWidth: 760,
    padding: t.spacing(1, 2, 0.5),
    position: 'relative',
    width: '100%',
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(0.75, 1, 0.5),
      paddingBottom: `max(${t.spacing(0.5)}px, env(safe-area-inset-bottom))`,
    },
  },
  box: {
    background: t.palette.primary.main,
    borderRadius: t.shape.borderRadius * 3.5,
    color: t.palette.primary.contrastText,
    padding: t.spacing(1, 1, 1, 1.75),
    '&:focus-within': {
      boxShadow: `0 0 0 2px ${M.fade(t.palette.secondary.main, 0.6)}`,
    },
  },
  text: {
    ...t.typography.body1,
    background: 'transparent',
    border: 0,
    color: 'inherit',
    display: 'block',
    font: 'inherit',
    lineHeight: '22px',
    maxHeight: 22 * 6,
    outline: 'none',
    overflowY: 'auto',
    padding: t.spacing(0.25, 0.25, 1),
    resize: 'none',
    width: '100%',
    '&::placeholder': { color: M.fade(t.palette.primary.contrastText, 0.6), opacity: 1 },
  },
  bar: {
    alignItems: 'center',
    display: 'flex',
    gap: `${t.spacing(0.5)}px`,
  },
  plus: {
    background: M.lighten(t.palette.primary.main, 0.12),
    color: 'inherit',
    height: 32,
    width: 32,
    '&:hover': { background: M.lighten(t.palette.primary.main, 0.2) },
    // The Touch Floor Rule: the pointer, not the width, sets the target.
    ['@media (pointer: coarse)']: { height: 44, width: 44 },
  },
  plusOpen: {
    boxShadow: `0 0 0 2px ${t.palette.secondary.main}`,
  },
  chip: {
    ...t.typography.body2,
    color: M.fade(t.palette.primary.contrastText, 0.85),
    maxWidth: t.spacing(24),
    minWidth: 0,
    padding: t.spacing(0.5, 1),
    textTransform: 'none',
  },
  chipLabel: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  send: {
    background: M.lighten(t.palette.primary.main, 0.2),
    color: 'inherit',
    height: 32,
    marginLeft: 'auto',
    width: 32,
    '&$sendOff': { color: M.fade(t.palette.primary.contrastText, 0.4) },
    ['@media (pointer: coarse)']: { height: 44, width: 44 },
  },
  sendOff: {},
  collapse: {
    color: M.fade(t.palette.primary.contrastText, 0.7),
    marginLeft: 'auto',
    '& + $send': { marginLeft: 0 },
    ['@media (pointer: coarse)']: { height: 44, width: 44 },
  },
  // Minimized (phone): one 44px bar, the Touch Floor's height, so the chat keeps the screen.
  mini: {
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.primary.main,
    borderRadius: 22,
    color: M.fade(t.palette.primary.contrastText, 0.85),
    display: 'flex',
    gap: `${t.spacing(1)}px`,
    height: 44,
    padding: t.spacing(0, 1.5),
    width: '100%',
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.secondary.main}`,
      outlineOffset: 2,
    },
  },
  miniMark: { color: t.palette.secondary.main, fontSize: 18 },
  miniText: {
    flexGrow: 1,
    overflow: 'hidden',
    textAlign: 'left',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  miniModel: {
    ...t.typography.caption,
    color: M.fade(t.palette.primary.contrastText, 0.6),
  },
  hint: {
    ...t.typography.caption,
    color: t.palette.text.hint,
    margin: t.spacing(0.5, 0.5, 0),
    minHeight: 18,
  },
  warning: { color: t.palette.warning.dark },
  error: { color: t.palette.error.dark },
}))

const useMenuStyles = M.makeStyles((t) => ({
  paper: {
    borderRadius: t.shape.borderRadius * 3,
    maxHeight: 'min(520px, 70vh)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  sheet: {
    borderRadius: `${t.shape.borderRadius * 4}px ${t.shape.borderRadius * 4}px 0 0`,
    maxHeight: '80dvh',
    paddingBottom: 'env(safe-area-inset-bottom)',
    display: 'flex',
    flexDirection: 'column',
  },
  body: { display: 'flex', flexDirection: 'column', minHeight: 0, outline: 'none' },
  scroll: { minHeight: 0, overflowY: 'auto' },
  grab: {
    background: t.palette.divider,
    borderRadius: 2,
    flexShrink: 0,
    height: 4,
    margin: t.spacing(1, 'auto', 0.5),
    width: 36,
  },
  search: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexShrink: 0,
    gap: `${t.spacing(1)}px`,
    padding: t.spacing(1.25, 2),
    '& input': {
      ...t.typography.body2,
      border: 0,
      flexGrow: 1,
      font: 'inherit',
      outline: 'none',
      padding: 0,
    },
  },
  searchIcon: { color: t.palette.text.secondary, fontSize: 18 },
  list: {
    margin: 0,
    overflowY: 'auto',
    padding: t.spacing(0.75),
  },
  row: {
    ...t.typography.body2,
    alignItems: 'center',
    borderRadius: t.shape.borderRadius * 2,
    cursor: 'pointer',
    display: 'flex',
    gap: `${t.spacing(1.25)}px`,
    minHeight: 36,
    padding: t.spacing(0.75, 1.25),
    '&[aria-disabled="true"]': { cursor: 'default', opacity: 0.6 },
    ['@media (pointer: coarse)']: { minHeight: 44 },
  },
  active: { background: M.fade(t.palette.primary.main, 0.07) },
  icon: { color: t.palette.text.secondary, flexShrink: 0, fontSize: 18 },
  name: {
    flexShrink: 0,
    fontWeight: t.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
  },
  detail: {
    color: t.palette.text.secondary,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mono: { fontFamily: t.typography.monospace?.fontFamily ?? 'monospace' },
  sub: {
    color: t.palette.text.secondary,
    display: 'block',
    ...t.typography.caption,
    whiteSpace: 'normal',
  },
  end: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    flexShrink: 0,
    gap: `${t.spacing(0.75)}px`,
    marginLeft: 'auto',
  },
  split: {
    alignSelf: 'stretch',
    borderLeft: `1px solid ${t.palette.divider}`,
    display: 'flex',
    alignItems: 'center',
    marginRight: t.spacing(-0.5),
    paddingLeft: t.spacing(0.5),
  },
  divider: { background: t.palette.divider, height: 1, margin: t.spacing(0.75, 0.5) },
  soon: {
    ...t.typography.caption,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: 10,
    padding: t.spacing(0, 0.75),
  },
  tag: {
    ...t.typography.caption,
    background: M.fade(t.palette.warning.main, 0.1),
    borderRadius: 10,
    color: t.palette.warning.dark,
    padding: t.spacing(0, 0.75),
    whiteSpace: 'nowrap',
  },
  dot: {
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
    height: 8,
    width: 8,
  },
  on: { background: t.palette.success.main },
  pending: { background: t.palette.warning.main },
  failed: { background: t.palette.error.main },
  heading: {
    ...t.typography.overline,
    color: t.palette.text.secondary,
    padding: t.spacing(1, 1.25, 0.25),
  },
  empty: { color: t.palette.text.secondary, padding: t.spacing(1.5, 1.25) },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${t.spacing(1.5)}px`,
    padding: t.spacing(1, 1.25, 1.5),
  },
  link: { color: 'inherit', textDecoration: 'none' },
}))

// --- connector snapshot ----------------------------------------------------

interface ConnectorView {
  id: string
  title: string
  state: Connectors.ConnectorState
  runtime: Connectors.ConnectorRuntime
}

/**
 * `byId` is fixed for the life of a connectors service, so the per-connector
 * `useState` calls keep a stable count, as in `Chat`.
 */
function useConnectorViews(connectors: API['connectors']): ConnectorView[] {
  const all = Object.values(connectors.byId)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const states = all.map((c) => Actor.useState(c.state))
  return all.map((c, i) => ({
    id: c.id,
    title: c.config.title,
    state: states[i],
    runtime: c,
  }))
}

const toolsOf = (s: Connectors.ConnectorState) =>
  s._tag === 'Ready' ? Object.entries(s.tools) : []

const statusText = (s: Connectors.ConnectorState, tools: number) =>
  Connectors.ConnectorState.$match(s, {
    Connecting: () => 'Connecting…',
    Ready: () => `On · ${tools} tool${tools === 1 ? '' : 's'}`,
    Disconnected: () => 'Reconnecting…',
    Failed: ({ error }) => `Failed: ${error.message}.`,
  })

// --- menu model ------------------------------------------------------------

type Page = 'main' | 'model' | 'tools' | 'mcp' | 'save' | 'instructions'

interface Row {
  key: string
  icon?: string
  name: string
  detail?: React.ReactNode
  sub?: React.ReactNode
  /** Machine-exact text (a package handle, a model id) sets in mono. */
  monoDetail?: boolean
  monoSub?: boolean
  end?: React.ReactNode
  /** Text the search box matches, beyond `name`. */
  keywords?: string
  disabled?: boolean
  role?: 'menuitem' | 'menuitemradio'
  checked?: boolean
  onSelect?: () => void
  /** `→` and Enter open this page. */
  opens?: Page
  divider?: boolean
  heading?: boolean
}

const matches = (r: Row, q: string) =>
  !q || `${r.name} ${r.keywords ?? ''}`.toLowerCase().includes(q.toLowerCase())

// --- Composer --------------------------------------------------------------

export interface ComposerProps {
  api: API
  disabled?: boolean
  helperText?: React.ReactNode
  helperSeverity?: 'warning' | 'error'
  onSubmit: (text: string) => void
  /** Without it the Save row is hidden: the host has no save target. */
  save?: SessionSave
  /** Prefills the text, e.g. from a starter prompt; changes when a new one is picked. */
  draft?: { text: string; at: number }
}

export default function Composer({
  api,
  disabled,
  helperText,
  helperSeverity,
  onSubmit,
  save,
  draft,
}: ComposerProps) {
  const classes = useStyles()
  const [value, setValue] = React.useState('')
  const textRef = React.useRef<HTMLTextAreaElement>(null)
  const plusRef = React.useRef<HTMLButtonElement>(null)
  const [open, setOpen] = React.useState<Page | null>(null)
  const inputId = useId()
  const t = M.useTheme()
  const phone = M.useMediaQuery(t.breakpoints.down('xs'))
  const [minimized, setMinimized] = React.useState(false)
  const minimize = () => {
    // Blurring first lets the on-screen keyboard close with the composer.
    textRef.current?.blur()
    setMinimized(true)
  }
  const restore = () => setMinimized(false)
  const wasMinimized = React.useRef(false)
  React.useEffect(() => {
    if (wasMinimized.current && !minimized) textRef.current?.focus()
    wasMinimized.current = minimized
  }, [minimized])
  React.useEffect(() => {
    if (!phone) setMinimized(false)
  }, [phone])
  // The mode is the composer's: the docked panel has no + menu to leave Ask from.
  const { setMode } = api
  React.useEffect(() => () => setMode('agent'), [setMode])

  React.useEffect(() => {
    if (!draft) return
    setValue(draft.text)
    textRef.current?.focus()
  }, [draft])

  // Grow with the text up to the CSS max height, then scroll.
  React.useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, minimized])

  const submit = () => {
    if (!value.trim() || disabled) return
    onSubmit(value)
    setValue('')
  }

  const close = React.useCallback(() => {
    setOpen(null)
    textRef.current?.focus()
  }, [])

  const model = api.model
  // Named even when it can't be switched: which model answers is never hidden.
  const modelName =
    ModelChoice.nameIn(model.names, model.current) ??
    ModelChoice.tier(model.current) ??
    ModelChoice.displayName(model.current)

  if (phone && minimized) {
    return (
      <div className={classes.root} data-composer>
        <M.ButtonBase
          className={classes.mini}
          onClick={restore}
          aria-label={value ? 'Show the composer, with your draft' : 'Show the composer'}
        >
          <M.Icon className={classes.miniMark}>auto_awesome</M.Icon>
          <span className={classes.miniText}>{value || 'Ask Qurator'}</span>
          {modelName && <span className={classes.miniModel}>{modelName}</span>}
          <M.Icon fontSize="small">expand_less</M.Icon>
        </M.ButtonBase>
      </div>
    )
  }

  return (
    <div className={classes.root} data-composer>
      <M.ThemeProvider theme={darkTheme}>
        <div className={classes.box}>
          <label htmlFor={inputId} style={srOnly}>
            Ask Qurator
          </label>
          <textarea
            id={inputId}
            ref={textRef}
            className={classes.text}
            rows={1}
            value={value}
            placeholder="Ask about your data, / for tools and actions"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              } else if (
                (e.key === '/' && !value) ||
                (e.key === 'k' && (e.metaKey || e.ctrlKey))
              ) {
                e.preventDefault()
                setOpen('main')
              }
            }}
            // Not on a phone: the on-screen keyboard would cover the starters before a tap.
            autoFocus={!phone}
          />
          <div className={classes.bar}>
            <M.IconButton
              ref={plusRef}
              className={cx(classes.plus, open && classes.plusOpen)}
              aria-label="Tools and actions"
              aria-haspopup="menu"
              aria-expanded={!!open}
              onClick={() => setOpen(open ? null : 'main')}
              size="small"
            >
              <M.Icon fontSize="small">add</M.Icon>
            </M.IconButton>
            {modelName && (
              <M.Tooltip title={model.current}>
                <M.Button
                  className={classes.chip}
                  aria-label={`Model: ${ModelChoice.label(model.current, ModelChoice.nameIn(model.names, model.current))}`}
                  aria-haspopup="menu"
                  disabled={disabled || !model.allowlist}
                  onClick={() => setOpen('model')}
                  endIcon={<M.Icon fontSize="small">expand_more</M.Icon>}
                >
                  <span className={classes.chipLabel}>{modelName}</span>
                </M.Button>
              </M.Tooltip>
            )}
            {phone && (
              <M.IconButton
                className={classes.collapse}
                aria-label="Minimize the composer"
                onClick={minimize}
                size="small"
              >
                <M.Icon fontSize="small">expand_more</M.Icon>
              </M.IconButton>
            )}
            <M.IconButton
              className={cx(classes.send, (disabled || !value.trim()) && classes.sendOff)}
              aria-label="Send"
              disabled={disabled || !value.trim()}
              onClick={submit}
              size="small"
            >
              <M.Icon fontSize="small">arrow_upward</M.Icon>
            </M.IconButton>
          </div>
        </div>
      </M.ThemeProvider>
      <div
        className={cx(classes.hint, helperSeverity && classes[helperSeverity])}
        role={helperSeverity ? 'status' : undefined}
      >
        {helperText ?? 'Qurator may make errors. Verify important information.'}
      </div>
      {/* The composer sits on the dark chat ground; its menu is light, like every other menu. */}
      <M.MuiThemeProvider theme={style.appTheme}>
        <PlusMenu
          api={api}
          save={save}
          anchor={plusRef.current}
          page={open}
          setPage={setOpen}
          onClose={close}
          disabled={disabled}
        />
      </M.MuiThemeProvider>
    </div>
  )
}

const srOnly: React.CSSProperties = {
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  position: 'absolute',
  width: 1,
}

// --- the + menu ------------------------------------------------------------

interface PlusMenuProps {
  api: API
  save?: SessionSave
  anchor: HTMLElement | null
  page: Page | null
  setPage: (p: Page | null) => void
  onClose: () => void
  disabled?: boolean
}

function PlusMenu({
  api,
  save,
  anchor,
  page,
  setPage,
  onClose,
  disabled,
}: PlusMenuProps) {
  const classes = useMenuStyles()
  const t = M.useTheme()
  const phone = M.useMediaQuery(t.breakpoints.down('xs'))
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const listId = useId()
  const views = useConnectorViews(api.connectors)
  const next = useFeature('qurator-composer-next')
  const isAdmin = !!redux.useSelector(authSelectors.isAdmin)
  const { urls } = NamedRoutes.use()

  React.useEffect(() => {
    setQuery('')
    setActive(0)
    // A click moves focus to the row; keys are read from the menu, but typing goes to search.
    if (page) requestAnimationFrame(() => searchRef.current?.focus())
  }, [page])

  const model = api.model
  const nameOf = (id: string) =>
    ModelChoice.label(id, ModelChoice.nameIn(model.names, id))
  const servers = views.filter((v) => v.id !== PLATFORM)
  const toolCount = views.reduce((n, v) => n + toolsOf(v.state).length, 0)
  const failed = servers.filter((v) => v.state._tag === 'Failed').length
  const on = servers.filter((v) => v.state._tag === 'Ready').length

  const pick = (fn: () => void) => () => {
    fn()
    onClose()
  }

  const back: Row = {
    key: 'back',
    icon: 'arrow_back',
    name: 'Back',
    onSelect: () => setPage('main'),
  }

  const pages: Record<Page, Row[]> = {
    main: [
      ...(save
        ? [
            {
              key: 'save',
              icon: 'inventory_2',
              name: save.status._tag === 'saving' ? 'Saving…' : 'Save to package',
              keywords: 'package session export',
              detail: `${save.bucket || 'no bucket'} / ${save.name}`,
              monoDetail: true,
              sub: saveSub(save),
              disabled: !!save.blocked,
              // Saving elsewhere than the session read goes through the target page,
              // which names those buckets before anything is written.
              onSelect: () => (save.foreign.length ? setPage('save') : save.save()),
              end: (
                <span className={classes.split}>
                  <M.IconButton
                    size="small"
                    aria-label="Change save target"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPage('save')
                    }}
                  >
                    <M.Icon fontSize="small">expand_more</M.Icon>
                  </M.IconButton>
                </span>
              ),
            } as Row,
          ]
        : []),
      ...(['agent', 'ask'] as const).map((m) => ({
        key: m,
        icon: m === 'agent' ? 'bolt' : 'help_outline',
        name: m === 'agent' ? 'Agent' : 'Ask',
        keywords: 'mode',
        detail:
          m === 'agent'
            ? 'Uses tools; changes ask first'
            : 'Answers without changing data',
        role: 'menuitemradio' as const,
        checked: api.mode === m,
        disabled,
        end: api.mode === m ? <M.Icon fontSize="small">check</M.Icon> : undefined,
        onSelect: pick(() => api.setMode(m)),
      })),
      { key: 'd1', name: '', divider: true },
      {
        key: 'model',
        icon: 'view_in_ar',
        name: 'Model',
        keywords: (model.allowlist ?? []).map(nameOf).join(' '),
        detail: nameOf(model.current),
        sub: model.allowlist
          ? undefined
          : model.readFailed
            ? "The approved model list couldn't be read, so this stack's default answers."
            : 'Set by this stack. An admin can approve more in Admin → Settings.',
        opens: model.allowlist ? ('model' as Page) : undefined,
        disabled: disabled || !model.allowlist,
        end: model.allowlist ? (
          <M.Icon fontSize="small">chevron_right</M.Icon>
        ) : undefined,
      },
      {
        key: 'tools',
        icon: 'build',
        name: 'Tools',
        keywords: views
          .flatMap((v) => toolsOf(v.state).map(([n]) => toolTitle(n)))
          .join(' '),
        detail: `${toolCount} tool${toolCount === 1 ? '' : 's'}`,
        opens: 'tools',
        end: <M.Icon fontSize="small">chevron_right</M.Icon>,
      },
      {
        key: 'mcp',
        icon: 'hub',
        name: 'MCP',
        keywords: `servers ${servers.map((v) => v.title).join(' ')}`,
        detail: servers.length
          ? [on && `${on} on`, failed && `${failed} failed`]
              .filter(Boolean)
              .join(' · ') || 'Connecting…'
          : 'No extra servers',
        opens: 'mcp',
        end: (
          <>
            {!!failed && <span className={cx(classes.dot, classes.pending)} />}
            <M.Icon fontSize="small">chevron_right</M.Icon>
          </>
        ),
      },
      {
        key: 'instructions',
        icon: 'tune',
        name: 'Instructions',
        keywords: 'personal global prompt',
        detail:
          api.instructions.global.active || api.instructions.personal.active
            ? 'On'
            : 'Off',
        opens: 'instructions',
        end: <M.Icon fontSize="small">chevron_right</M.Icon>,
      },
      ...(next
        ? [
            {
              key: 'files',
              icon: 'attach_file',
              name: 'Files and context',
              disabled: true,
              end: <span className={classes.soon}>Soon</span>,
            },
          ]
        : []),
    ],
    model: [
      back,
      ...(model.allowlist ?? []).map((id) => ({
        key: id,
        name: nameOf(id),
        keywords: id,
        sub: id,
        monoSub: true,
        role: 'menuitemradio' as const,
        checked: id === model.current,
        end: id === model.current ? <M.Icon fontSize="small">check</M.Icon> : undefined,
        onSelect: pick(() => model.select(id)),
      })),
    ],
    tools: [
      back,
      ...views.flatMap((v) => {
        const tools = toolsOf(v.state)
        return [
          { key: `h-${v.id}`, name: v.title, heading: true } as Row,
          ...(tools.length
            ? tools.map(([n, d]) => ({
                key: n,
                name: toolTitle(n),
                keywords: `${v.title} ${d.description ?? ''}`,
                sub: d.description?.split('\n')[0],
                // Ask mode never offers these to the model (Context.forMode).
                disabled: d.effect !== 'read' && api.mode === 'ask',
                end:
                  d.effect === 'read' ? undefined : (
                    <span className={classes.tag}>
                      {api.mode === 'ask'
                        ? 'off in Ask'
                        : d.effect === 'destructive'
                          ? 'deletes · asks first'
                          : 'asks first'}
                    </span>
                  ),
              }))
            : [
                { key: `e-${v.id}`, name: statusText(v.state, 0), disabled: true } as Row,
              ]),
        ]
      }),
    ],
    mcp: [
      back,
      ...(views.map((v) => ({
        key: v.id,
        name: v.title,
        keywords: v.id,
        icon: undefined,
        detail: undefined,
        sub: statusText(v.state, toolsOf(v.state).length),
        end:
          v.state._tag === 'Failed' ? (
            <M.Button
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation()
                runtime.runFork(v.runtime.retry)
              }}
            >
              Retry
            </M.Button>
          ) : undefined,
        dot:
          v.state._tag === 'Ready'
            ? 'on'
            : v.state._tag === 'Failed'
              ? 'failed'
              : 'pending',
        onSelect:
          v.state._tag === 'Failed' ? () => runtime.runFork(v.runtime.retry) : undefined,
      })) as (Row & { dot?: string })[]),
      ...(isAdmin
        ? [
            { key: 'd2', name: '', divider: true },
            {
              key: 'add',
              icon: 'add',
              name: 'Add server…',
              detail: 'Admin → Settings',
              onSelect: pick(() => {
                window.location.assign(urls.adminSettings())
              }),
            },
          ]
        : []),
    ],
    save: [back],
    instructions: [back],
  }

  const rows = page
    ? pages[page].filter((r) => r.divider || r.heading || matches(r, query))
    : []
  // Dividers and headings only frame a list; drop them when a search narrows it.
  const shown = query ? rows.filter((r) => !r.divider && !r.heading) : rows
  const focusable = shown
    .map((r, i) => (r.divider || r.heading || r.disabled ? -1 : i))
    .filter((i) => i >= 0)
  const activeIdx = focusable[Math.min(active, focusable.length - 1)] ?? -1

  const activate = (r: Row) => {
    if (r.disabled) return
    if (r.opens) setPage(r.opens)
    else r.onSelect?.()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Typing in a form field, or Enter on a nested button, is not menu navigation.
    const target = e.target as HTMLElement
    if (
      target !== searchRef.current &&
      target.closest('input, textarea, select, button')
    ) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.nativeEvent.stopPropagation()
        setPage('main')
      }
      return
    }
    const r = shown[activeIdx]
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, focusable.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (r) activate(r)
    } else if (e.key === 'ArrowRight' && r?.opens) {
      e.preventDefault()
      setPage(r.opens)
    } else if ((e.key === 'ArrowLeft' && !query) || e.key === 'Escape') {
      e.preventDefault()
      e.nativeEvent.stopPropagation()
      if (page !== 'main') setPage('main')
      else onClose()
    }
  }

  // Focus can leave the menu body (a control that disables itself while saving),
  // so Escape is also caught on the document; handlers inside stop it first.
  React.useEffect(() => {
    if (!page) return
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (page !== 'main') setPage('main')
      else onClose()
    }
    document.addEventListener('keydown', onDocKey)
    return () => document.removeEventListener('keydown', onDocKey)
  }, [page, setPage, onClose])

  const body = page && (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className={classes.body} onKeyDown={onKeyDown}>
      {phone && <div className={classes.grab} />}
      {page !== 'save' && page !== 'instructions' && (
        <div className={classes.search}>
          <M.Icon className={classes.searchIcon}>search</M.Icon>
          <input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder={
              page === 'main'
                ? 'Search tools, packages, MCP…'
                : `Search ${page === 'mcp' ? 'servers' : page}…`
            }
            aria-label="Search Qurator actions"
            aria-controls={listId}
            aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
          />
        </div>
      )}
      {page === 'save' && save ? (
        <SaveTarget save={save} onBack={() => setPage('main')} onDone={onClose} />
      ) : page === 'instructions' ? (
        <div
          className={classes.scroll}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            e.nativeEvent.stopPropagation()
            setPage('main')
          }}
        >
          <MenuRow
            row={back}
            id={`${listId}-back`}
            active={false}
            onActivate={() => setPage('main')}
            onHover={() => {}}
          />
          <Instructions instructions={api.instructions} />
        </div>
      ) : (
        <div
          className={classes.list}
          id={listId}
          role="menu"
          aria-label="Qurator actions"
        >
          {shown.length === focusable.length && !focusable.length && (
            <div className={classes.empty} role="presentation">
              No matches
            </div>
          )}
          {shown.map((r, i) =>
            r.divider ? (
              <div key={r.key} className={classes.divider} role="separator" />
            ) : r.heading ? (
              <div key={r.key} className={classes.heading} role="presentation">
                {r.name}
              </div>
            ) : (
              <MenuRow
                key={r.key}
                row={r}
                id={`${listId}-${i}`}
                active={i === activeIdx}
                onActivate={() => activate(r)}
                onHover={() => setActive(Math.max(0, focusable.indexOf(i)))}
              />
            ),
          )}
        </div>
      )}
    </div>
  )

  if (phone) {
    return (
      <M.SwipeableDrawer
        anchor="bottom"
        open={!!page}
        onClose={onClose}
        onOpen={() => setPage('main')}
        disableSwipeToOpen
        // Escape belongs to the menu: back one level from a submenu, close from the top.
        ModalProps={{ disableEscapeKeyDown: true }}
        PaperProps={{ className: classes.sheet }}
      >
        {body}
      </M.SwipeableDrawer>
    )
  }

  return (
    <M.Popover
      open={!!page && !!anchor}
      anchorEl={anchor?.closest('[data-composer]') ?? anchor}
      onClose={onClose}
      // Escape belongs to the menu: back one level from a submenu, close from the top.
      disableEscapeKeyDown
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      elevation={8}
      PaperProps={{
        className: classes.paper,
        style: {
          width: Math.min(
            560,
            (anchor?.closest('[data-composer]') as HTMLElement)?.offsetWidth ?? 560,
          ),
        },
      }}
      marginThreshold={8}
    >
      {body}
    </M.Popover>
  )
}

function saveSub(save: SessionSave) {
  switch (save.status._tag) {
    case 'error':
      return save.status.message
    case 'saved':
      return `Saved @${save.status.hash.slice(0, 8)}. Choose it again for a new revision.`
    default:
      return save.blocked && save.blocked !== 'Busy' ? save.blocked : undefined
  }
}

interface MenuRowProps {
  row: Row & { dot?: string }
  id: string
  active: boolean
  onActivate: () => void
  onHover: () => void
}

function MenuRow({ row, id, active, onActivate, onHover }: MenuRowProps) {
  const classes = useMenuStyles()
  return (
    <div
      id={id}
      className={cx(classes.row, active && classes.active)}
      role={row.role ?? 'menuitem'}
      aria-checked={row.role === 'menuitemradio' ? !!row.checked : undefined}
      aria-disabled={row.disabled || undefined}
      aria-haspopup={row.opens ? 'menu' : undefined}
      tabIndex={-1}
      onClick={onActivate}
      onMouseMove={onHover}
    >
      {row.dot ? (
        <span
          className={cx(classes.dot, classes[row.dot as 'on' | 'pending' | 'failed'])}
        />
      ) : (
        row.icon && <M.Icon className={classes.icon}>{row.icon}</M.Icon>
      )}
      <span
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          flex: '0 1 auto',
        }}
      >
        <span style={{ display: 'flex', gap: 8, minWidth: 0, alignItems: 'baseline' }}>
          <span className={classes.name}>{row.name}</span>
          {row.detail && (
            <span className={cx(classes.detail, row.monoDetail && classes.mono)}>
              {row.detail}
            </span>
          )}
        </span>
        {row.sub && (
          <span className={cx(classes.sub, row.monoSub && classes.mono)}>{row.sub}</span>
        )}
      </span>
      {row.end && <span className={classes.end}>{row.end}</span>}
    </div>
  )
}

// --- save target picker ----------------------------------------------------

interface SaveTargetProps {
  save: SessionSave
  onBack: () => void
  onDone: () => void
}

function SaveTarget({ save, onBack, onDone }: SaveTargetProps) {
  const classes = useMenuStyles()
  const { urls } = NamedRoutes.use()
  return (
    <div
      className={classes.scroll}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        e.stopPropagation()
        e.nativeEvent.stopPropagation()
        onBack()
      }}
    >
      <div className={classes.list} role="menu">
        <MenuRow
          row={{ key: 'back', icon: 'arrow_back', name: 'Save target' }}
          id="save-back"
          active={false}
          onActivate={onBack}
          onHover={() => {}}
        />
      </div>
      <div className={classes.form}>
        <M.TextField
          select
          size="small"
          label="Bucket"
          value={save.bucket}
          onChange={(e) => save.setBucket(e.target.value)}
          SelectProps={{ native: true }}
        >
          {save.buckets.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </M.TextField>
        <M.TextField
          size="small"
          label="Package name"
          value={save.name}
          onChange={(e) => save.setName(e.target.value)}
          error={save.blocked === NAME_TAKEN}
          helperText={
            save.blocked === NAME_TAKEN
              ? 'A package with this name exists. Pick a new name.'
              : 'Saving again adds a revision.'
          }
        />
        {!!save.foreign.length && (
          <M.Typography variant="caption" color="textSecondary">
            This session also read {save.foreign.join(', ')}. Anyone who can read{' '}
            {save.bucket} will see what you save.
          </M.Typography>
        )}
        <M.FormControlLabel
          control={
            <M.Checkbox
              size="small"
              checked={save.includeResults}
              onChange={(e) => save.setIncludeResults(e.target.checked)}
            />
          }
          label={<M.Typography variant="body2">Include tool results</M.Typography>}
        />
        <M.Button
          variant="contained"
          color="primary"
          disabled={!!save.blocked}
          onClick={async () => {
            await save.save()
          }}
        >
          {save.status._tag === 'saving' ? 'Saving…' : 'Save to this package'}
        </M.Button>
        {save.status._tag === 'error' && (
          <M.Typography variant="body2" color="error" role="alert">
            {save.status.message}
          </M.Typography>
        )}
        {save.status._tag === 'saved' && (
          <M.Typography variant="body2" role="status">
            Saved{' '}
            <M.Link
              component={Link}
              to={urls.bucketPackageTree(
                save.status.bucket,
                save.status.name,
                save.status.hash,
              )}
              onClick={onDone}
            >
              {save.status.name}@{save.status.hash.slice(0, 8)}
            </M.Link>
          </M.Typography>
        )}
      </div>
    </div>
  )
}
