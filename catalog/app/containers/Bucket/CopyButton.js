import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import StyledLink from 'utils/StyledLink'
import { docs } from 'constants/urls'

import * as ERRORS from './errors'
import * as requests from './requests'

function MenuPlaceholder() {
  const t = M.useTheme()

  return (
    <M.Box minWidth={t.spacing(22)}>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(6)} width="100%" />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(6)} width="100%" />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(6)} width="100%" />
      </M.MenuItem>
    </M.Box>
  )
}

const MenuItem = React.forwardRef(function MenuItem({ item, onClick }, ref) {
  return (
    <M.MenuItem
      ref={ref}
      onClick={React.useCallback(() => onClick(item), [item, onClick])}
    >
      <M.ListItemText primary={item.name} secondary={item.url} />
    </M.MenuItem>
  )
})

function SuccessorsSelect({ anchorEl, bucket, open, onChange, onClose }) {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsList, { s3, bucket })

  return (
    <M.Menu anchorEl={anchorEl} onClose={onClose} open={open}>
      {data.case({
        Ok: ({ successors }) =>
          successors.length ? (
            successors.map((successor) => (
              <MenuItem key={successor.slug} item={successor} onClick={onChange} />
            ))
          ) : (
            <M.Box px={2} py={1}>
              <M.Typography gutterBottom>
                Bucket&apos;s successors are not configured.
              </M.Typography>
              <M.Typography>
                Please, read{' '}
                <StyledLink
                  href={`${docs}/advanced-usage/workflows#pushing-across-buckets-with-the-quilt-catalog`}
                  target="_blank"
                >
                  the documentation
                </StyledLink>
                .
              </M.Typography>
            </M.Box>
          ),
        _: () => <MenuPlaceholder />,
        Err: (error) => (
          <M.Box px={2} py={1}>
            <M.Typography gutterBottom>
              Error: <code>{error.message}</code>
            </M.Typography>
            {R.is(ERRORS.WorkflowsConfigInvalid, error) && (
              <M.Typography>
                Please fix the workflows config according to{' '}
                <StyledLink href={`${docs}/advanced-usage/workflows`} target="_blank">
                  the documentation
                </StyledLink>
              </M.Typography>
            )}
          </M.Box>
        ),
      })}
    </M.Menu>
  )
}

const useButtonStyles = M.makeStyles(() => ({
  root: {
    flexShrink: 0,
    margin: '-3px 0',
  },
}))

function Button({ children, onClick }) {
  const classes = useButtonStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  const props = {
    'aria-haspopup': 'true',
    className: classes.root,
    onClick,
    size: 'small',
  }

  return sm ? (
    <M.IconButton edge="end" title={children} {...props}>
      <M.Icon>exit_to_app</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button variant="outlined" {...props}>
      {children}
    </M.Button>
  )
}

export default function CopyButton({ bucket, onChange }) {
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)

  const onButtonClick = React.useCallback(
    (event) => setMenuAnchorEl(event.currentTarget),
    [setMenuAnchorEl],
  )

  const onMenuClick = React.useCallback(
    (menuItem) => {
      onChange(menuItem)
      setMenuAnchorEl(null)
    },
    [onChange, setMenuAnchorEl],
  )

  const onMenuClose = React.useCallback(() => setMenuAnchorEl(null), [setMenuAnchorEl])

  return (
    <>
      <Button onClick={onButtonClick}>Push to bucket</Button>

      <SuccessorsSelect
        anchorEl={menuAnchorEl}
        bucket={bucket}
        open={!!menuAnchorEl}
        onChange={onMenuClick}
        onClose={onMenuClose}
      />
    </>
  )
}
