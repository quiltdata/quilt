import * as React from 'react'
import * as M from '@material-ui/core'

import * as UserInstructions from 'components/Assistant/Model/UserInstructions'

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

export default function QuratorSettings() {
  const classes = useStyles()
  const instructions = UserInstructions.useGlobalInstructions()
  const { enabled } = instructions
  const { draft, setDraft, dirty, pending, error, save, toggle } =
    UserInstructions.useInstructionsEditor(instructions)

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
