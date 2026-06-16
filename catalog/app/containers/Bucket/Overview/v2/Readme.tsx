import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { Fetcher } from 'utils/Data'

import * as Summarize from '../../Summarize'
import * as requests from '../../requests'

const COLLAPSED_HEIGHT = 320

const useStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
    position: 'relative',
  },
  clamp: {
    maxHeight: COLLAPSED_HEIGHT,
    overflow: 'hidden',
  },
  toggle: {
    marginTop: t.spacing(1),
  },
}))

interface FoldProps {
  handle: Model.S3.S3ObjectLocation
}

function Fold({ handle }: FoldProps) {
  const classes = useStyles()
  const [expanded, setExpanded] = React.useState(false)
  const toggle = React.useCallback(() => setExpanded((e) => !e), [])
  return (
    <div className={classes.root} data-testid="readme-preview">
      <div className={expanded ? undefined : classes.clamp}>
        <Summarize.FilePreview handle={handle} expanded />
      </div>
      <M.Button className={classes.toggle} size="small" onClick={toggle}>
        {expanded ? 'Show less' : 'Show more'}
      </M.Button>
    </div>
  )
}

interface ReadmeProps {
  bucket: string
}

export default function Readme({ bucket }: ReadmeProps) {
  const s3 = AWS.S3.use()
  return (
    // @ts-expect-error untyped Fetcher
    <Fetcher fetch={requests.bucketReadmes} params={{ s3, bucket }}>
      {AsyncResult.case({
        Ok: (readmes: Model.S3.S3ObjectLocation[]) =>
          readmes.length ? <Fold handle={readmes[0]} /> : null,
        _: () => <Summarize.FilePreviewSkel />,
      })}
    </Fetcher>
  )
}
