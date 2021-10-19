import * as React from 'react'
import * as M from '@material-ui/core'

import Slides from 'website/components/Slides'

const useSlideBlockStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: t.spacing(10),
    paddingTop: t.spacing(10),
  },
  slides: {
    maxWidth: '50rem',
  },
}))

export default function SlideBlock(props: Parameters<typeof Slides>[0]) {
  const classes = useSlideBlockStyles()
  return (
    <div className={classes.root}>
      <Slides {...props} className={classes.slides} />
    </div>
  )
}
