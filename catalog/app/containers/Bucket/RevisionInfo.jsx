import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import { linkStyle } from 'utils/StyledLink'
import copyToClipboard from 'utils/clipboard'

import * as requests from './requests'

function useRevisionsData({ bucket, name }) {
  const req = APIConnector.use()
  return useData(requests.getPackageRevisions, { req, bucket, name, perPage: 5 })
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
}))

export default function RevisionInfo({ revisionData, revision, bucket, name, path }) {
  const { urls } = NamedRoutes.use()
  const { push } = Notifications.use()
  const classes = useRevisionInfoStyles()

  const listRef = React.useRef()
  const [anchor, setAnchor] = React.useState()
  const [opened, setOpened] = React.useState(false)
  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  const revisionsData = useRevisionsData({ bucket, name })
  const data = revisionsData.case({
    Ok: (revisions) =>
      revisionData.case({
        Ok: ({ hash }) =>
          AsyncResult.Ok(revisions.map((r) => ({ ...r, selected: r.hash === hash }))),
        Err: () => AsyncResult.Ok(revisions),
        _: R.identity,
      }),
    _: R.identity,
  })

  const getHttpsUri = (r) =>
    `${window.origin}${urls.bucketPackageTree(bucket, name, r.hash, path)}`

  const copyHttpsUri = (r, containerRef) => (e) => {
    e.preventDefault()
    copyToClipboard(getHttpsUri(r), { container: containerRef && containerRef.current })
    push('Canonical URI copied to clipboard')
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <span
        className={classes.revision}
        onClick={open}
        ref={setAnchor}
        title={revision.length > 10 ? revision : undefined}
      >
        {R.take(10, revision)} <M.Icon>expand_more</M.Icon>
      </span>

      {revisionData.case({
        Ok: (r) => (
          <M.IconButton
            size="small"
            title="Copy package revision's canonical catalog URI to the clipboard"
            href={getHttpsUri(r)}
            onClick={copyHttpsUri(r)}
            style={{ marginTop: -4, marginBottom: -4 }}
          >
            <M.Icon>link</M.Icon>
          </M.IconButton>
        ),
        _: () => null,
      })}

      <M.Popover
        open={opened && !!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <M.List className={classes.list} ref={listRef}>
          {AsyncResult.case(
            {
              Ok: R.ifElse(
                R.isEmpty,
                () => (
                  <M.ListItem>
                    <M.ListItemText
                      primary="No revisions found"
                      secondary="Looks like this package has been deleted"
                    />
                  </M.ListItem>
                ),
                R.map((r) => (
                  <M.ListItem
                    key={r.hash}
                    button
                    onClick={close}
                    selected={r.selected}
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
                        href={getHttpsUri(r)}
                        onClick={copyHttpsUri(r, listRef)}
                      >
                        <M.Icon>link</M.Icon>
                      </M.IconButton>
                    </M.ListItemSecondaryAction>
                  </M.ListItem>
                )),
              ),
              Err: () => (
                <M.ListItem>
                  <M.ListItemIcon>
                    <M.Icon>error</M.Icon>
                  </M.ListItemIcon>
                  <M.Typography variant="body1">Error fetching revisions</M.Typography>
                </M.ListItem>
              ),
              _: () => (
                <M.ListItem>
                  <M.ListItemIcon>
                    <M.CircularProgress size={24} />
                  </M.ListItemIcon>
                  <M.Typography variant="body1">Fetching revisions</M.Typography>
                </M.ListItem>
              ),
            },
            data,
          )}
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
