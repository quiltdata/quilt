import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
    color: t.palette.text.disabled,
  },
  text: {
    padding: t.spacing(1, 0),
    textAlign: 'center',
  },
}))

interface AttributionProps {
  className: string
}

export default function Attribution({ className }: AttributionProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Container maxWidth="lg">
        <M.Typography className={classes.text} variant="caption" component="p">
          Icons used: “
          <a href="https://thenounproject.com/icon/data-sharing-5406825/">Data Sharing</a>
          ” by Candy Design “
          <a href="https://thenounproject.com/icon/upload-database-322726/">
            Upload Database
          </a>
          ” by Smashicons “
          <a href="https://thenounproject.com/icon/data-visualization-5039056/">
            data visualization
          </a>
          ” by SAM Designs from Noun Project
        </M.Typography>
      </M.Container>
    </div>
  )
}
