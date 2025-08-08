import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'
import ClearIcon from '@material-ui/icons/Clear'

import JsonDisplay from 'components/JsonDisplay'

import * as Model from '../../Model'
import * as Bedrock from '../../Model/Bedrock'

const useModelIdOverrideStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
}))

function ModelIdOverride() {
  const classes = useModelIdOverrideStyles()

  const [modelId, setModelId] = React.useState(Bedrock.getModelIdOverride)

  const handleModelIdChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setModelId(event.target.value)
    },
    [],
  )

  React.useEffect(() => Bedrock.setModelIdOverride(modelId), [modelId])

  const handleClear = React.useCallback(() => setModelId(''), [])

  return (
    <div className={classes.root}>
      <M.TextField
        label="Bedrock Model ID"
        placeholder={Bedrock.DEFAULT_MODEL_ID}
        value={modelId}
        onChange={handleModelIdChange}
        fullWidth
        helperText="Leave empty to use default"
        InputLabelProps={{ shrink: true }}
        InputProps={{
          endAdornment: modelId ? (
            <M.InputAdornment position="end">
              <M.IconButton
                aria-label="Clear model ID override"
                onClick={handleClear}
                edge="end"
                size="small"
              >
                <M.Tooltip arrow title="Clear model ID override">
                  <ClearIcon />
                </M.Tooltip>
              </M.IconButton>
            </M.InputAdornment>
          ) : null,
        }}
      />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  heading: {
    ...t.typography.h5,
    borderBottom: `1px solid ${t.palette.divider}`,
    lineHeight: '64px',
    paddingLeft: t.spacing(2),
  },
  contents: {
    flexGrow: 1,
    overflow: 'auto',
  },
  json: {
    margin: t.spacing(2, 0),
    padding: t.spacing(0, 2),
  },
}))

interface DevToolsProps {
  state: Model.Assistant.API['state']
}

export default function DevTools({ state }: DevToolsProps) {
  const classes = useStyles()

  const context = Model.Context.useAggregatedContext()

  const prompt = React.useMemo(
    () =>
      Eff.Effect.runSync(
        Model.Conversation.constructPrompt(
          state.events.filter((e) => !e.discarded),
          context,
        ),
      ),
    [state, context],
  )

  return (
    <section className={classes.root}>
      <h1 className={classes.heading}>Qurator Developer Tools</h1>
      <div className={classes.contents}>
        <ModelIdOverride />
        <JsonDisplay className={classes.json} name="Context" value={context} />
        <JsonDisplay className={classes.json} name="State" value={state} />
        <JsonDisplay className={classes.json} name="Prompt" value={prompt} />
      </div>
    </section>
  )
}
