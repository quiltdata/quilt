import * as React from 'react'
import * as M from '@material-ui/core'

import * as ModelChoice from 'components/Assistant/Model/ModelChoice'
import * as GQL from 'utils/GraphQL'

import QURATOR_AVAILABLE_MODELS_QUERY from './gql/QuratorAvailableModels.generated'
import QURATOR_CONFIG_QUERY from './gql/QuratorConfig.generated'
import SET_QURATOR_CONFIG_MUTATION from './gql/SetQuratorConfig.generated'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(2),
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  default: {
    minWidth: 320,
  },
  checklist: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    flexWrap: 'nowrap',
    maxHeight: t.spacing(40),
    overflowY: 'auto',
    padding: t.spacing(0.5, 1.5),
  },
  modelId: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    display: 'block',
    fontFamily: t.typography.monospace?.fontFamily ?? 'monospace',
  },
  note: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  nameRow: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
  },
  nameId: {
    flex: 1,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  nameField: {
    flexShrink: 0,
    width: 280,
  },
  save: {
    marginLeft: 'auto',
  },
  error: {
    ...t.typography.body2,
    color: t.palette.error.main,
  },
}))

// The registry's limit.
const MAX_NAME_LENGTH = 64

export function parseIds(text: string): string[] {
  return Array.from(new Set(text.split(/\s+/).filter(Boolean)))
}

/** The saved set, split into the ids the checklist offers and the rest. */
export function splitSaved(saved: readonly string[], offered: readonly string[]) {
  return {
    checked: saved.filter((id) => offered.includes(id)),
    extra: saved.filter((id) => !offered.includes(id)),
  }
}

/**
 * Ticked ids in list order, then typed ones, without repeats. A ticked id the
 * listing no longer offers (it refetches after a save) is kept, not dropped.
 */
export function combineIds(
  checked: readonly string[],
  offered: readonly string[],
  text: string,
) {
  const ticked = offered.filter((id) => checked.includes(id))
  const unlisted = checked.filter((id) => !offered.includes(id))
  return Array.from(new Set([...ticked, ...unlisted, ...parseIds(text)]))
}

type Names = Readonly<Record<string, string>>

// Own keys only: a typed id such as `constructor` must not find a prototype method.
const nameIn = (names: Names, id: string) =>
  Object.prototype.hasOwnProperty.call(names, id) ? names[id] : undefined

/** Display names for the ids being saved, in their order: trimmed, blanks dropped. */
export function namesFor(ids: readonly string[], names: Names) {
  return ids.flatMap((id) => {
    const name = nameIn(names, id)?.trim()
    return name ? [{ id, name }] : []
  })
}

const toNames = (list: readonly { id: string; name: string }[] | null | undefined) =>
  Object.fromEntries((list ?? []).map((n) => [n.id, n.name]))

type Unavailable = GQL.DataForDoc<
  typeof QURATOR_AVAILABLE_MODELS_QUERY
>['admin']['quratorAvailableModels']['unavailable']
type Available = NonNullable<
  GQL.DataForDoc<
    typeof QURATOR_AVAILABLE_MODELS_QUERY
  >['admin']['quratorAvailableModels']['models']
>

const UNAVAILABLE_NOTE: Record<string, string> = {
  GATEWAY:
    "This stack sends Qurator through an AI gateway, which can't list its models. Enter the full model IDs your organization has approved.",
  LISTING_FAILED:
    "This account's Bedrock models couldn't be listed. Enter full model IDs below.",
}

/** The same set regardless of order: the listing's order is not the saved one. */
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id))

/**
 * The listing is read without suspending, so a failed one (Bedrock down, or a
 * registry without the query) leaves the plain id box instead of taking the
 * whole section down.
 */
export default function QuratorModelSettings() {
  const { admin } = GQL.useQueryS(QURATOR_CONFIG_QUERY)
  const listing = GQL.useQuery(QURATOR_AVAILABLE_MODELS_QUERY)
  return GQL.fold(listing, {
    data: ({ admin: { quratorAvailableModels: l } }) => (
      <Editor
        config={admin.quratorConfig}
        available={l.models ?? []}
        unavailable={l.unavailable}
      />
    ),
    fetching: () => <M.CircularProgress size={24} />,
    error: () => (
      <Editor config={admin.quratorConfig} available={[]} unavailable="LISTING_FAILED" />
    ),
  })
}

interface EditorProps {
  config: GQL.DataForDoc<typeof QURATOR_CONFIG_QUERY>['admin']['quratorConfig']
  available: Available
  unavailable: Unavailable | 'LISTING_FAILED'
}

function Editor({ config, available, unavailable }: EditorProps) {
  const classes = useStyles()
  const setConfig = GQL.useMutation(SET_QURATOR_CONFIG_MUTATION)

  const offered = React.useMemo(() => available.map((m) => m.id), [available])

  const [saved, setSaved] = React.useState(config)
  const savedIds = saved.models.allowlist ?? []
  const initial = splitSaved(savedIds, offered)
  const [checked, setChecked] = React.useState<string[]>(initial.checked)
  const [text, setText] = React.useState(initial.extra.join('\n'))

  // A ticked model the refreshed listing no longer offers moves to the id box,
  // where it stays saved and the admin can still see and remove it.
  React.useEffect(() => {
    const gone = checked.filter((id) => !offered.includes(id))
    if (!gone.length) return
    setChecked((c) => c.filter((id) => offered.includes(id)))
    setText((t) =>
      [...parseIds(t), ...gone.filter((id) => !parseIds(t).includes(id))].join('\n'),
    )
  }, [offered]) // eslint-disable-line react-hooks/exhaustive-deps
  const [chosenDefault, setChosenDefault] = React.useState(saved.models.default ?? '')
  const [names, setNames] = React.useState<Names>(() => toNames(saved.models.names))
  const [pending, setPending] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])

  const ids = React.useMemo(
    () => combineIds(checked, offered, text),
    [checked, offered, text],
  )
  // The registry refuses a default outside the set, so one is always picked
  // from the set itself, falling back to its first member.
  const effectiveDefault = ids.includes(chosenDefault) ? chosenDefault : (ids[0] ?? '')

  const namesOut = React.useMemo(() => namesFor(ids, names), [ids, names])
  const savedNames = React.useMemo(() => toNames(saved.models.names), [saved])
  const dirty =
    !sameSet(ids, savedIds) ||
    effectiveDefault !== (saved.models.default ?? '') ||
    namesOut.length !== Object.keys(savedNames).length ||
    namesOut.some((n) => savedNames[n.id] !== n.name)

  const toggle = React.useCallback(
    (id: string) =>
      setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])),
    [],
  )

  const nameOf = React.useCallback(
    (id: string) => nameIn(names, id)?.trim() || available.find((m) => m.id === id)?.name,
    [available, names],
  )

  // Typed ids, plus any saved id that already has a name, so no saved name is
  // kept out of the admin's sight.
  const named = React.useMemo(() => {
    const typed = parseIds(text)
    return ids.filter((id) => typed.includes(id) || nameIn(savedNames, id))
  }, [ids, text, savedNames])

  const save = React.useCallback(async () => {
    setPending(true)
    setErrors([])
    try {
      // A whole-row replace: the gateway and the limits are written back as
      // they were read, or this save would clear them.
      const { admin: result } = await setConfig({
        input: {
          allowlist: ids.length ? ids : null,
          default: ids.length ? effectiveDefault : null,
          gatewayEndpointUrl: saved.gateway.endpointUrl,
          gatewayAccountId: saved.gateway.accountId,
          requestTimeoutSeconds: saved.models.requestTimeoutSeconds,
          maxToolCallsPerTurn: saved.models.maxToolCallsPerTurn,
          names: namesOut.length ? namesOut : null,
        },
      })
      const r = result.setQuratorConfig
      switch (r.__typename) {
        case 'QuratorConfig':
          setSaved(r)
          const next = splitSaved(r.models.allowlist ?? [], offered)
          setChecked(next.checked)
          setText(next.extra.join('\n'))
          setChosenDefault(r.models.default ?? '')
          setNames(toNames(r.models.names))
          break
        case 'InvalidInput':
          setErrors(r.errors.map((e) => e.message))
          break
        case 'OperationError':
          setErrors([r.message])
          break
      }
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)])
    } finally {
      setPending(false)
    }
  }, [setConfig, ids, effectiveDefault, namesOut, saved, offered])

  return (
    <div className={classes.root}>
      <M.Typography className={classes.note}>
        Users choose among the allowed models in Qurator, and no other model is relayed.
        Allow none to let users run any model, as before.
      </M.Typography>
      {unavailable ? (
        <M.Typography className={classes.note} role="status">
          {UNAVAILABLE_NOTE[unavailable] ?? UNAVAILABLE_NOTE.LISTING_FAILED}
        </M.Typography>
      ) : !available.length ? (
        <M.Typography className={classes.note} role="status">
          No models were found in this account's Bedrock. Enter full model IDs below.
        </M.Typography>
      ) : (
        <M.FormControl component="fieldset" disabled={pending}>
          <M.FormLabel component="legend">Models in this account's Bedrock</M.FormLabel>
          <M.FormGroup className={classes.checklist}>
            {available.map((m) => (
              <M.FormControlLabel
                key={m.id}
                control={
                  <M.Checkbox
                    checked={checked.includes(m.id)}
                    color="primary"
                    onChange={() => toggle(m.id)}
                    size="small"
                  />
                }
                label={
                  <span>
                    {m.name}
                    <span className={classes.modelId}>{m.id}</span>
                  </span>
                }
              />
            ))}
          </M.FormGroup>
        </M.FormControl>
      )}
      <M.TextField
        fullWidth
        multiline
        rows={3}
        rowsMax={12}
        variant="outlined"
        id="qurator-models-allowlist"
        label={offered.length ? 'Additional model IDs' : 'Allowed model IDs'}
        placeholder="us.anthropic.claude-sonnet-4-5-20250929-v1:0"
        value={text}
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        helperText="One full Bedrock model ID, inference profile ID, or SageMaker endpoint ARN per line. In an ARN, write the endpoint name in the case it was created with; AWS shows it lowercased."
      />
      {!!named.length && (
        <M.FormControl component="fieldset" disabled={pending}>
          <M.FormLabel component="legend">Display names</M.FormLabel>
          <M.FormHelperText>
            Optional. Qurator's model menu shows this instead of the model ID.
          </M.FormHelperText>
          {named.map((id) => (
            <div key={id} className={classes.nameRow}>
              <span className={`${classes.modelId} ${classes.nameId}`}>{id}</span>
              <M.TextField
                className={classes.nameField}
                size="small"
                margin="dense"
                variant="outlined"
                label="Display name"
                placeholder={ModelChoice.displayName(id)}
                inputProps={{
                  'aria-label': `Display name for ${id}`,
                  maxLength: MAX_NAME_LENGTH,
                }}
                value={nameIn(names, id) ?? ''}
                disabled={pending}
                onChange={(e) => {
                  const value = e.target.value
                  setNames((n) => ({ ...n, [id]: value }))
                }}
              />
            </div>
          ))}
        </M.FormControl>
      )}
      <div className={classes.controls}>
        <M.TextField
          className={classes.default}
          select
          variant="outlined"
          size="small"
          id="qurator-models-default"
          label="Default model"
          value={effectiveDefault}
          disabled={pending || !ids.length}
          onChange={(e) => setChosenDefault(e.target.value)}
        >
          {ids.map((id) => (
            <M.MenuItem key={id} value={id}>
              {nameOf(id) ? (
                <span>
                  {nameOf(id)}
                  <span className={classes.modelId}>{id}</span>
                </span>
              ) : (
                <span className={classes.modelId}>{id}</span>
              )}
            </M.MenuItem>
          ))}
        </M.TextField>
        <M.Button
          className={classes.save}
          color="primary"
          disabled={!dirty || pending}
          onClick={save}
          size="small"
          variant="outlined"
        >
          Save
        </M.Button>
      </div>
      {errors.map((message, i) => (
        <M.Typography key={i} className={classes.error} role="alert">
          {message}
        </M.Typography>
      ))}
    </div>
  )
}
