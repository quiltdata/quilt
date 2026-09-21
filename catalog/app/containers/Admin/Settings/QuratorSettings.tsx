import * as React from 'react'
import * as M from '@material-ui/core'

import * as UserInstructions from 'components/Assistant/Model/UserInstructions'
import * as CatalogSettings from 'utils/CatalogSettings'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(1),
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
  },
  save: {
    marginLeft: 'auto',
  },
  hint: {
    ...t.typography.caption,
    color: t.palette.text.hint,
  },
  error: {
    ...t.typography.body2,
    color: t.palette.error.main,
  },
}))

const errorMessage = (e: unknown) =>
  e instanceof CatalogSettings.SettingsConflictError
    ? e.message
    : "Couldn't save settings, see console for details"

export default function QuratorSettings() {
  const classes = useStyles()
  const { text, setText, enabled, setEnabled } = UserInstructions.useUserInstructions()

  const [draft, setDraft] = React.useState(text)
  React.useEffect(() => setDraft(text), [text])
  const dirty = draft !== text

  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const run = React.useCallback(async (op: () => Promise<void>) => {
    setPending(true)
    setError(null)
    try {
      await op()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error saving Qurator settings', e)
      setError(errorMessage(e))
    } finally {
      setPending(false)
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

  return (
    <div className={classes.root}>
      <M.TextField
        fullWidth
        multiline
        rows={4}
        rowsMax={12}
        variant="outlined"
        placeholder="e.g. Prefer concise answers. Always cite package names and revisions."
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        inputProps={{ 'aria-label': 'Qurator instructions' }}
      />
      <div className={classes.controls}>
        <M.FormControlLabel
          control={
            <M.Switch
              checked={enabled}
              color="primary"
              disabled={pending}
              onChange={toggle}
              size="small"
            />
          }
          label="Apply to every message"
        />
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
      {error ? (
        <M.Typography className={classes.error} role="alert">
          {error}
        </M.Typography>
      ) : (
        <span className={classes.hint}>
          Standing instructions sent with every Qurator message for everyone on this
          stack.
        </span>
      )}
    </div>
  )
}
