import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Markdown from 'components/Markdown'
import Skeleton from 'components/Skeleton'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { Fetcher, useData } from 'utils/Data'

import * as requests from '../../requests'

import { useContentOverflows } from './useContentOverflows'

// Collapsed READMEs are clamped to roughly a dozen lines so a long README
// can't dominate the compact header; the toggle reveals the rest.
const COLLAPSED_MAX_HEIGHT = 24 // theme spacing units

const useStyles = M.makeStyles((t) => ({
  wrapper: {
    position: 'relative',
  },
  content: {
    overflow: 'hidden',
  },
  collapsed: {
    maxHeight: t.spacing(COLLAPSED_MAX_HEIGHT),
  },
  fade: {
    background: `linear-gradient(to bottom, ${M.fade(
      t.palette.background.paper,
      0,
    )}, ${t.palette.background.paper})`,
    bottom: 0,
    height: t.spacing(6),
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
  },
  toggle: {
    marginTop: t.spacing(1),
  },
}))

function isNotebook(handle: Model.S3.S3ObjectLocation): boolean {
  return handle.key.toLowerCase().endsWith('.ipynb')
}

interface CollapsibleMarkdownProps {
  text: string
}

export function CollapsibleMarkdown({ text }: CollapsibleMarkdownProps) {
  const classes = useStyles()
  const ref = React.useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = React.useState(false)
  // Drives the toggle's visibility so short READMEs render no button and no
  // clamp artifact. Frozen while expanded so the "Show less" button stays.
  const overflows = useContentOverflows(ref, !expanded, [text])

  return (
    <div data-testid="readme-preview">
      <div className={classes.wrapper}>
        <div ref={ref} className={cx(classes.content, !expanded && classes.collapsed)}>
          <Markdown data={text} />
        </div>
        {!expanded && overflows && <div className={classes.fade} />}
      </div>
      {overflows && (
        <M.Button
          className={classes.toggle}
          size="small"
          color="primary"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </M.Button>
      )}
    </div>
  )
}

interface ReadmeContentsProps {
  handle: Model.S3.S3ObjectLocation
}

function ReadmeContents({ handle }: ReadmeContentsProps) {
  const s3 = AWS.S3.use()
  const data = useData(requests.fetchFile, { s3, handle })
  return data.case({
    // Errors must not break the header: render nothing.
    Err: () => null,
    Ok: ({ body }: { body?: $TSFixMe }) => (
      <CollapsibleMarkdown text={body?.toString('utf-8') ?? ''} />
    ),
    _: () => <Skeleton height={48} />,
  })
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
        Ok: (readmes: Model.S3.S3ObjectLocation[]) => {
          // NOTE: .ipynb is excluded from the compact header fold; a clamped
          // notebook reads poorly in a tight header. Full notebook rendering
          // remains available elsewhere (e.g. the Summary section).
          const handle = readmes.find((h) => !isNotebook(h))
          if (!handle) return null
          return <ReadmeContents handle={handle} />
        },
        Err: () => null,
        _: () => <Skeleton height={48} />,
      })}
    </Fetcher>
  )
}
