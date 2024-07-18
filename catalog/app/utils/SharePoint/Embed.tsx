import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

const useEmbedSkeletonStyles = M.makeStyles((t) => ({
  header: {
    height: t.spacing(6),
  },
  body: {
    padding: '20px',
  },
  content: {
    height: t.spacing(70),
  },
}))

function EmbedSkeleton() {
  const classes = useEmbedSkeletonStyles()

  return (
    <div>
      <Skeleton className={classes.header} />
      <div className={classes.body}>
        <Skeleton className={classes.content} />
      </div>
    </div>
  )
}

interface EmbedProps {
  url?: string
}

export default function Embed({ url }: EmbedProps) {
  return url ? <iframe width="100%" height="600px" src={url} /> : <EmbedSkeleton />
}
