import * as React from 'react'
import * as M from '@material-ui/core'

// const useStyles = M.makeStyles((t) => ({
// }))

interface AthenaProps {
  bucket: string
  className: string
}

export default function Athena({ bucket, className }: AthenaProps) {
  // const classes = useStyles()

  return (
    <div className={className}>
      <M.Typography variant="h6">Athena SQL {bucket}</M.Typography>
    </div>
  )
}
