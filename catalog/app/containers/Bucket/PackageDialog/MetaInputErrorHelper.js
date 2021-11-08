import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

const useSingleErrorStyles = M.makeStyles((t) => ({
  code: {
    backgroundColor: t.palette.error.light,
    border: `1px solid ${t.palette.error.dark}`,
    borderRadius: '2px',
    color: t.palette.error.contrastText,
    marginRight: '6px',
    padding: '1px 2px',
  },
}))

function SingleError({ className, error }) {
  const classes = useSingleErrorStyles()

  return (
    <Lab.Alert severity="error" className={className}>
      {error.instancePath && (
        <>
          <code className={classes.code}>{error.instancePath}</code>
        </>
      )}
      {error.message}
    </Lab.Alert>
  )
}

const useStyles = M.makeStyles((t) => ({
  item: {
    '& + &': {
      marginTop: t.spacing(1),
    },
  },
}))

export default function ErrorHelper({ className, error }) {
  const classes = useStyles()

  if (!error) return null

  return (
    <div className={className}>
      {Array.isArray(error) ? (
        error.map((e) => (
          <SingleError
            className={classes.item}
            error={e}
            key={e.instancePath + e.message}
          />
        ))
      ) : (
        <SingleError error={error} />
      )}
    </div>
  )
}
