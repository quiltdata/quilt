import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useStyles = M.makeStyles((t) => ({
  code: {
    backgroundColor: t.palette.error.light,
    border: `1px solid ${t.palette.error.dark}`,
    borderRadius: '2px',
    color: t.palette.error.contrastText,
    marginRight: '6px',
    padding: '1px 2px',
  },
}))

function SingleError({ error }) {
  const classes = useStyles()

  return (
    <Lab.Alert severity="error">
      {error.dataPath && (
        <>
          <code className={classes.code}>{error.dataPath}</code>
        </>
      )}
      {error.message}
    </Lab.Alert>
  )
}

export default function ErrorHelper({ className, error }) {
  if (!error) return null

  return (
    <div className={className}>
      {Array.isArray(error) ? (
        error.map((e) => <SingleError error={e} key={error.dataPath + error.message} />)
      ) : (
        <SingleError error={error} />
      )}
    </div>
  )
}
