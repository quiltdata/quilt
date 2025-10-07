import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import * as Diff from '../PackageCompare/Diff'
import { useRevision } from '../PackageCompare/useRevision'

import type REVISION_LIST_QUERY from './gql/RevisionList.generated'

type RevisionListQuery = GQL.QueryResultForDoc<typeof REVISION_LIST_QUERY>

function getPreviousHash(revisionListQuery: RevisionListQuery, hash?: string) {
  return GQL.fold(revisionListQuery, {
    data: (d) => {
      if (!d.package) return null
      const revisions = d.package.revisions.page
      if (revisions.length < 2) return null
      const base = revisions.findIndex((r) => r.hash === hash)
      return revisions[base + 1]?.hash
    },
    error: () => null,
    fetching: () => null,
  })
}

interface SummaryPopoverProps {
  bucket: string
  name: string
  leftHash: string
  rightHash: string
  onClose: () => void
}

function SummaryPopover({
  bucket,
  name,
  leftHash,
  rightHash,
  onClose,
}: SummaryPopoverProps) {
  const classes = useRevisionInfoStyles()
  const { urls } = NamedRoutes.use()

  const leftRevision = useRevision(bucket, name, leftHash)
  const rightRevision = useRevision(bucket, name, rightHash)

  const compareUrl = urls.bucketPackageCompare(bucket, name, leftHash, rightHash)

  return (
    <div className={classes.summaryPopover}>
      <div className={classes.summaryHeader}>
        <M.Typography variant="subtitle1">What's changed</M.Typography>
      </div>
      <div className={classes.summaryContent}>
        <Diff.Summary left={leftRevision} right={rightRevision} />
      </div>
      <div className={classes.detailsLink}>
        <M.Button
          component={RRLink}
          to={compareUrl}
          onClick={onClose}
          size="small"
          startIcon={<Icons.OpenInNew />}
        >
          View detailed comparison
        </M.Button>
      </div>
    </div>
  )
}

interface SummaryButtonProps {
  bucket: string
  name: string
  prevHash: string
  hash: string
  className?: string
}

function SummaryButton({ bucket, name, prevHash, hash, className }: SummaryButtonProps) {
  const [anchor, setAnchor] = React.useState<HTMLButtonElement | null>(null)
  const [opened, setOpened] = React.useState(false)

  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  return (
    <>
      <M.IconButton
        className={className}
        size="small"
        title="What's changed"
        onClick={open}
        ref={setAnchor}
      >
        <Icons.CompareArrows />
      </M.IconButton>

      <M.Popover
        open={opened && !!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {
          <SummaryPopover
            bucket={bucket}
            name={name}
            leftHash={prevHash}
            rightHash={hash}
            onClose={close}
          />
        }
      </M.Popover>
    </>
  )
}

const useRevisionInfoStyles = M.makeStyles((t) => ({
  revision: {
    ...linkStyle,
    alignItems: 'center',
    display: 'inline-flex',
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  line: {
    whiteSpace: 'nowrap',
  },
  secondaryText: {
    display: 'block',
    height: 40,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  list: {
    width: 560,
  },
  shortcut: {
    margin: t.spacing(-0.5, 0, -0.5, 1),
  },
  summaryPopover: {
    width: 480,
    maxHeight: 400,
    overflow: 'auto',
  },
  summaryHeader: {
    padding: t.spacing(2, 2, 1),
    borderBottom: `1px solid ${t.palette.divider}`,
  },
  summaryContent: {
    padding: t.spacing(1, 2, 2),
  },
  detailsLink: {
    padding: t.spacing(1, 2),
    borderTop: `1px solid ${t.palette.divider}`,
  },
}))

interface RevisionInfoProps {
  bucket: string
  name: string
  path: string
  hashOrTag: string
  hash?: string
  revisionListQuery: RevisionListQuery
}

export default function RevisionInfo({
  bucket,
  name,
  hash,
  hashOrTag,
  path,
  revisionListQuery,
}: RevisionInfoProps) {
  const { urls } = NamedRoutes.use()
  const { push } = Notifications.use()
  const classes = useRevisionInfoStyles()

  const listRef = React.useRef<HTMLUListElement>(null)
  const [anchor, setAnchor] = React.useState<HTMLSpanElement | null>(null)
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  const getHttpsUri = (h: string) =>
    `${window.origin}${urls.bucketPackageTree(bucket, name, h, path)}`

  const copyHttpsUri =
    (h: string, containerRef?: React.RefObject<HTMLUListElement>) =>
    (e: React.MouseEvent) => {
      e.preventDefault()
      copyToClipboard(getHttpsUri(h), { container: containerRef?.current || undefined })
      push('Canonical URI copied to clipboard')
    }

  const prevHash = React.useMemo(
    () => getPreviousHash(revisionListQuery, hash),
    [hash, revisionListQuery],
  )

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span
        className={classes.revision}
        onClick={open}
        ref={setAnchor}
        title={hashOrTag.length > 10 ? hashOrTag : undefined}
      >
        {R.take(10, hashOrTag)} <M.Icon>expand_more</M.Icon>
      </span>

      {!!hash && (
        <>
          {prevHash && (
            <SummaryButton
              bucket={bucket}
              name={name}
              prevHash={prevHash}
              hash={hash}
              className={classes.shortcut}
            />
          )}
          <M.IconButton
            size="small"
            title="Copy package revision's canonical catalog URI to the clipboard"
            href={getHttpsUri(hash)}
            onClick={copyHttpsUri(hash)}
            className={classes.shortcut}
          >
            <M.Icon>link</M.Icon>
          </M.IconButton>
        </>
      )}

      <M.Popover
        open={opened && !!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <M.List className={classes.list} ref={listRef}>
          {GQL.fold(revisionListQuery, {
            data: (d) =>
              d.package ? (
                d.package.revisions.page.map((r) => (
                  <M.ListItem
                    key={`${r.hash}:${r.modified.valueOf()}`}
                    button
                    onClick={close}
                    selected={r.hash === hash}
                    component={RRLink}
                    to={urls.bucketPackageTree(bucket, name, r.hash, path)}
                  >
                    <M.ListItemText
                      primary={dateFns.format(r.modified, 'MMMM do yyyy - h:mma')}
                      secondary={
                        <span className={classes.secondaryText}>
                          <span className={classes.line}>
                            {r.message || <i>No message</i>}
                          </span>
                          <br />
                          <span className={cx(classes.line, classes.mono)}>{r.hash}</span>
                        </span>
                      }
                    />
                    <M.ListItemSecondaryAction>
                      <M.IconButton
                        title="Compare with this version"
                        href={urls.bucketPackageCompare(bucket, name, hash, r.hash)}
                      >
                        <Icons.CompareArrows />
                      </M.IconButton>
                      <M.IconButton
                        title="Copy package revision's canonical catalog URI to the clipboard"
                        href={getHttpsUri(r.hash)}
                        onClick={copyHttpsUri(r.hash, listRef)}
                      >
                        <M.Icon>link</M.Icon>
                      </M.IconButton>
                    </M.ListItemSecondaryAction>
                  </M.ListItem>
                ))
              ) : (
                <M.ListItem>
                  <M.ListItemText
                    primary="No revisions found"
                    secondary="Looks like this package has been deleted"
                  />
                </M.ListItem>
              ),
            error: () => (
              <M.ListItem>
                <M.ListItemIcon>
                  <M.Icon>error</M.Icon>
                </M.ListItemIcon>
                <M.Typography variant="body1">Error fetching revisions</M.Typography>
              </M.ListItem>
            ),
            fetching: () => (
              <M.ListItem>
                <M.ListItemIcon>
                  <M.CircularProgress size={24} />
                </M.ListItemIcon>
                <M.Typography variant="body1">Fetching revisions</M.Typography>
              </M.ListItem>
            ),
          })}
          <M.Divider />
          <M.ListItem
            button
            onClick={close}
            component={RRLink}
            to={urls.bucketPackageRevisions(bucket, name)}
          >
            <M.Box textAlign="center" width="100%">
              Show all revisions
            </M.Box>
          </M.ListItem>
        </M.List>
      </M.Popover>
    </>
  )
}
