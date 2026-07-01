import { matchSorter } from 'match-sorter'
import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'

// 1A "sidebar selector": the active volume lives in the rail as a rolled-up,
// fuzzy-filtered picker. Collapsed it shows the current volume (or a prompt);
// expanded it reveals a filter input over the relevant buckets. The whole
// stack is one keystroke away but never rendered inline, replacing the old
// always-visible bucket tree without losing fast switching. Reuses the same
// primitives as NavBar/BucketSelect (useRelevantBuckets + matchSorter).

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(0, 1),
  },
  trigger: {
    color: 'inherit',
    justifyContent: 'flex-start',
    padding: t.spacing(0.5, 1),
    textTransform: 'none',
    width: '100%',
  },
  dot: {
    background: t.palette.primary.main,
    borderRadius: '50%',
    flexShrink: 0,
    height: 6,
    marginRight: t.spacing(1),
    width: 6,
  },
  label: {
    flexGrow: 1,
    fontFamily: ['Roboto Mono', 'monospace'].join(','),
    fontSize: 12,
    overflow: 'hidden',
    textAlign: 'left',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  placeholder: {
    color: t.palette.text.hint,
    flexGrow: 1,
    fontSize: 12,
    textAlign: 'left',
  },
  paper: {
    padding: t.spacing(1),
    width: t.spacing(30),
  },
  list: {
    maxHeight: t.spacing(36),
    overflow: 'auto',
  },
  item: {
    borderRadius: t.shape.borderRadius,
    fontFamily: ['Roboto Mono', 'monospace'].join(','),
    fontSize: 12.5,
  },
}))

export function VolumeSelect() {
  const classes = useStyles()
  const history = useHistory()
  const { urls } = NamedRoutes.use()
  const currentBucket = Buckets.useCurrentBucket()
  const buckets = Buckets.useRelevantBuckets()

  const anchorRef = React.useRef<HTMLButtonElement>(null)
  const [open, setOpen] = React.useState(false)
  const [filter, setFilter] = React.useState('')

  const filtered = React.useMemo(() => {
    if (!filter) return buckets
    return matchSorter(buckets, filter, {
      keys: ['name', 'title', { key: 'tags' }],
    })
  }, [buckets, filter])

  const close = React.useCallback(() => {
    setOpen(false)
    setFilter('')
  }, [])

  const pick = React.useCallback(
    (name: string) => {
      if (name && name !== currentBucket) history.push(urls.bucketRoot(name))
      close()
    },
    [close, currentBucket, history, urls],
  )

  return (
    <div className={classes.root}>
      <M.Button
        ref={anchorRef}
        className={classes.trigger}
        onClick={() => setOpen((o) => !o)}
        size="small"
      >
        {currentBucket ? (
          <>
            <span className={classes.dot} />
            <span className={classes.label}>{currentBucket}</span>
          </>
        ) : (
          <span className={classes.placeholder}>Select a volume…</span>
        )}
        <M.Icon fontSize="small">expand_more</M.Icon>
      </M.Button>
      <M.Popper
        anchorEl={anchorRef.current}
        open={open}
        placement="bottom-start"
        style={{ zIndex: 1400 }}
      >
        <M.ClickAwayListener onClickAway={close}>
          <M.Paper className={classes.paper} elevation={8}>
            <M.TextField
              autoFocus
              fullWidth
              margin="dense"
              placeholder="Filter volumes…"
              value={filter}
              variant="outlined"
              onChange={(e) => setFilter(e.target.value)}
              InputProps={{
                startAdornment: (
                  <M.InputAdornment position="start">
                    <M.Icon fontSize="small">search</M.Icon>
                  </M.InputAdornment>
                ),
              }}
            />
            <M.List dense className={classes.list} disablePadding>
              {filtered.map((b) => (
                <M.ListItem
                  button
                  key={b.name}
                  className={classes.item}
                  component={Link}
                  to={urls.bucketRoot(b.name)}
                  selected={b.name === currentBucket}
                  onClick={() => pick(b.name)}
                >
                  <M.ListItemText
                    primary={b.name}
                    primaryTypographyProps={{ noWrap: true }}
                  />
                </M.ListItem>
              ))}
              {!filtered.length && (
                <M.ListItem>
                  <M.ListItemText
                    secondary={`No volumes matching "${filter}"`}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </M.ListItem>
              )}
            </M.List>
          </M.Paper>
        </M.ClickAwayListener>
      </M.Popper>
    </div>
  )
}

export default function VolumeSelectSuspended() {
  return (
    <React.Suspense fallback={null}>
      <VolumeSelect />
    </React.Suspense>
  )
}
