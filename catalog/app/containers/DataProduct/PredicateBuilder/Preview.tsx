import * as React from 'react'
import * as M from '@material-ui/core'

import type { PreviewState } from './model'

// A predicate's effect is not legible from its text, so the builder shows what
// it currently resolves to before anything is saved.
//
// Advisory, not authoritative. This runs client-side against packages-search
// with the author's own credentials; the registry re-resolves and re-authorizes
// every member at save and at read (qu-ncy). A preview that disagreed with the
// server would be a bug in one of the two, never a grant.

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.default,
    borderRadius: t.shape.borderRadius,
    padding: t.spacing(2),
  },
  header: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
    marginBottom: t.spacing(1),
  },
  count: {
    ...t.typography.h6,
  },
  hits: {
    margin: 0,
    maxHeight: t.spacing(30),
    overflowY: 'auto',
    padding: 0,
  },
  hit: {
    listStyle: 'none',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  name: {
    fontWeight: t.typography.fontWeightMedium,
  },
}))

interface PreviewProps {
  className?: string
  state: PreviewState
}

export default function Preview({ className, state }: PreviewProps) {
  const classes = useStyles()

  if (state.error) {
    return (
      <M.Box className={className}>
        <M.Typography
          color="error"
          variant="body2"
          data-testid="predicate-preview--error"
        >
          {state.error}
        </M.Typography>
      </M.Box>
    )
  }

  if (state.fetching) {
    return (
      <M.Box className={className}>
        <M.Typography variant="body2" color="textSecondary">
          Resolving members&hellip;
        </M.Typography>
      </M.Box>
    )
  }

  if (state.total === null) {
    return (
      <M.Box className={className}>
        <M.Typography variant="body2" color="textSecondary">
          Add a pattern or a metadata filter to preview the members it selects.
        </M.Typography>
      </M.Box>
    )
  }

  return (
    <div className={`${classes.root} ${className || ''}`}>
      <div className={classes.header}>
        <span className={classes.count} data-testid="predicate-preview--total">
          {state.total}
        </span>
        <M.Typography variant="body2" color="textSecondary">
          {state.total === 1 ? 'matching package' : 'matching packages'}
        </M.Typography>
      </div>

      {state.approximate && (
        // The registry filters entries within each matching package; package
        // search cannot, so saying "N members" here would be a number the saved
        // product will not agree with.
        <M.Typography variant="caption" color="textSecondary" component="p">
          The entry path pattern narrows which files are included within each package;
          this count is packages, so the member count will be lower.
        </M.Typography>
      )}

      {!!state.hits.length && (
        <ul className={classes.hits}>
          {state.hits.map((h) => (
            <li className={classes.hit} key={h.id}>
              <M.Typography variant="body2" component="span" className={classes.name}>
                {h.name}
              </M.Typography>{' '}
              <M.Typography variant="caption" component="span" color="textSecondary">
                s3://{h.bucket}
              </M.Typography>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
