import * as React from 'react'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'

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

export default function QuratorModelSettings() {
  const classes = useStyles()
  const { admin } = GQL.useQueryS(QURATOR_CONFIG_QUERY)
  const setConfig = GQL.useMutation(SET_QURATOR_CONFIG_MUTATION)

  const [saved, setSaved] = React.useState(admin.quratorConfig)
  const savedText = (saved.models.allowlist ?? []).join('\n')
  const [text, setText] = React.useState(savedText)
  const [chosenDefault, setChosenDefault] = React.useState(saved.models.default ?? '')
  const [pending, setPending] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])

  const ids = React.useMemo(() => parseIds(text), [text])
  // The registry refuses a default outside the set, so one is always picked
  // from the set itself, falling back to its first member.
  const effectiveDefault = ids.includes(chosenDefault) ? chosenDefault : (ids[0] ?? '')

  const dirty =
    ids.join('\n') !== savedText || effectiveDefault !== (saved.models.default ?? '')

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
          setText((r.models.allowlist ?? []).join('\n'))
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
  }, [setConfig, ids, effectiveDefault, saved])

  return (
    <div className={classes.root}>
      <M.TextField
        fullWidth
        multiline
        rows={4}
        rowsMax={12}
        variant="outlined"
        id="qurator-models-allowlist"
        label="Allowed models"
        placeholder="us.anthropic.claude-sonnet-4-5-20250929-v1:0"
        value={text}
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        helperText={
          'One full Bedrock model ID per line. Users choose among these in Qurator, and ' +
          'no other model is relayed. Leave empty to allow any model, as before. ' +
          "Through an AI gateway, enter the IDs your organization has approved: the gateway can't list them."
        }
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
              {id}
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
      {errors.map((message) => (
        <M.Typography key={message} className={classes.error} role="alert">
          {message}
        </M.Typography>
      ))}
    </div>
  )
}
