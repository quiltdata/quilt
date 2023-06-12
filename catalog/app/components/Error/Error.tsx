import * as React from 'react'
import * as M from '@material-ui/core'

import { printObject } from 'utils/string'

import sand from './sand.jpg'

const useStyles = M.makeStyles((t) => ({
  image: {
    background: `url(${sand}) repeat`,
    boxShadow: `
      inset 0 0 10px ${t.palette.background.paper},
      inset 0 0 20px ${t.palette.background.paper},
      inset 0 0 50px ${t.palette.background.paper},
      inset 0 0 100px ${t.palette.background.paper}`,
    height: '600px', // 254px is header, tabs, title and description
    marginTop: t.spacing(2),
  },
}))

interface ErrorProps {
  headline?: React.ReactNode
  detail?: React.ReactNode
  object?: {}
}

export default function Error({
  detail = 'Check network connection and login',
  headline = 'Something went wrong',
  object,
}: ErrorProps) {
  const classes = useStyles()
  return (
    <>
      <M.Typography variant="h4" gutterBottom>
        {headline}
      </M.Typography>
      <M.Typography variant="body1">{detail}</M.Typography>
      <div className={classes.image} />
      {!!object && <pre>{printObject(object)}</pre>}
    </>
  )
}
