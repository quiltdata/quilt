import * as React from 'react'
import * as M from '@material-ui/core'

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
    ...t.typography.caption,
    color: t.palette.text.secondary,
    display: 'block',
    fontFamily: t.typography.monospace?.fontFamily ?? 'monospace',
  },
  note: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  save: {
    marginLeft: 'auto',
  },
  error: {
    ...t.typography.body2,
    color: t.palette.error.main,
  },
}))

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

/** Ticked ids in list order, then typed ones, without repeats. */
export function combineIds(
  checked: readonly string[],
  offered: readonly string[],
  text: string,
) {
  const ticked = offered.filter((id) => checked.includes(id))
  return Array.from(new Set([...ticked, ...parseIds(text)]))
}

const UNAVAILABLE_NOTE = {
  GATEWAY:
    "This stack sends Qurator through an AI gateway, which can't list its models. Enter the full model IDs your organization has approved.",
  LISTING_FAILED:
    "This account's Bedrock models couldn't be listed. Enter full model IDs below.",
} as const

export default function QuratorModelSettings() {
  const classes = useStyles()
  const { admin } = GQL.useQueryS(QURATOR_CONFIG_QUERY)
  const setConfig = GQL.useMutation(SET_QURATOR_CONFIG_MUTATION)

  const { admin: listing } = GQL.useQueryS(QURATOR_AVAILABLE_MODELS_QUERY)
  const available = React.useMemo(
    () => listing.quratorAvailableModels.models ?? [],
    [listing.quratorAvailableModels.models],
  )
  const offered = React.useMemo(() => available.map((m) => m.id), [available])

  const [saved, setSaved] = React.useState(admin.quratorConfig)
  const savedIds = saved.models.allowlist ?? []
  const initial = splitSaved(savedIds, offered)
  const [checked, setChecked] = React.useState<string[]>(initial.checked)
  const [text, setText] = React.useState(initial.extra.join('\n'))
  const [chosenDefault, setChosenDefault] = React.useState(saved.models.default ?? '')
  const [pending, setPending] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])

  const ids = React.useMemo(
    () => combineIds(checked, offered, text),
    [checked, offered, text],
  )
  // The registry refuses a default outside the set, so one is always picked
  // from the set itself, falling back to its first member.
  const effectiveDefault = ids.includes(chosenDefault) ? chosenDefault : (ids[0] ?? '')

  const dirty =
    ids.join('\n') !== savedIds.join('\n') ||
    effectiveDefault !== (saved.models.default ?? '')

  const toggle = React.useCallback(
    (id: string) =>
      setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])),
    [],
  )

  const nameOf = React.useCallback(
    (id: string) => available.find((m) => m.id === id)?.name,
    [available],
  )

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
  }, [setConfig, ids, effectiveDefault, saved, offered])

  return (
    <div className={classes.root}>
      <M.Typography className={classes.note}>
        Users choose among the allowed models in Qurator, and no other model is relayed.
        Allow none to let users run any model, as before.
      </M.Typography>
      {listing.quratorAvailableModels.unavailable ? (
        <M.Typography className={classes.note} role="status">
          {UNAVAILABLE_NOTE[listing.quratorAvailableModels.unavailable]}
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
                    {m.provider ? `${m.provider} · ${m.name}` : m.name}
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
        helperText="One full Bedrock model ID or inference profile ID per line."
      />
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
              {nameOf(id) ?? id}
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
