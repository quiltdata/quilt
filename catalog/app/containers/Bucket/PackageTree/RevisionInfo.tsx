import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import RevisionSummary from './RevisionSummary'

import type REVISION_LIST_QUERY from './gql/RevisionList.generated'

type RevisionListQuery = GQL.QueryResultForDoc<typeof REVISION_LIST_QUERY>

function getPreviousHash(revisionListQuery: RevisionListQuery, hash: string) {
  return GQL.fold(revisionListQuery, {
    data: (d) => {
      if (!d.package) return null
      const revisions = d.package.revisions.page
      if (revisions.length < 2) return null
      const base = revisions.findIndex((r) => r.hash === hash)
      return base >= 0 ? revisions[base + 1]?.hash : null
    },
    error: () => null,
    fetching: () => null,
  })
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
    width: 420,
  },
  shortcut: {
    margin: t.spacing(-0.5, 0, -0.5, 1),
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

  const comparePair: [string, string] | null = React.useMemo(() => {
    if (!hash) return null
    const prevHash = getPreviousHash(revisionListQuery, hash)
    return prevHash ? [prevHash, hash] : null
  }, [hash, revisionListQuery])

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

      {comparePair && (
        <RevisionSummary
          bucket={bucket}
          name={name}
          hashes={comparePair}
          className={classes.shortcut}
        />
      )}

      {!!hash && (
        <M.IconButton
          size="small"
          title="Copy package revision's canonical catalog URI to the clipboard"
          href={getHttpsUri(hash)}
          onClick={copyHttpsUri(hash)}
          className={classes.shortcut}
        >
          <M.Icon>link</M.Icon>
        </M.IconButton>
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
