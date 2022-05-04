import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { docs } from 'constants/urls'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import StyledLink from 'utils/StyledLink'
import type * as workflows from 'utils/workflows'

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

interface MenuItemProps {
  item: workflows.Successor
  onClick: (x: workflows.Successor) => void
}

const MenuItem = React.forwardRef<HTMLLIElement, MenuItemProps>(function MenuItem(
  { item, onClick },
  ref,
) {
  return (
    <M.MenuItem
      ref={ref}
      onClick={React.useCallback(() => onClick(item), [item, onClick])}
    >
      <M.ListItemText primary={item.name} secondary={item.url} />
    </M.MenuItem>
  )
})

interface SuccessorsSelectProps {
  anchorEl: HTMLElement | null
  bucket: string
  open: boolean
  onChange: (x: workflows.Successor) => void
  onClose: () => void
}

export default function SuccessorsSelect({
  anchorEl,
  bucket,
  open,
  onChange,
  onClose,
}: SuccessorsSelectProps) {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket })

  return (
    <M.Menu anchorEl={anchorEl} onClose={onClose} open={open}>
      {data.case({
        Ok: ({ successors }: { successors: workflows.Successor[] }) =>
          successors.length ? (
            successors.map((successor) => (
              <MenuItem key={successor.slug} item={successor} onClick={onChange} />
            ))
          ) : (
            <M.Box px={2} py={1}>
              <M.Typography gutterBottom>
                Add or update a config.yml file to populate this menu.
              </M.Typography>
              <M.Typography>
                <StyledLink
                  href={`${docs}/advanced/workflows#cross-bucket-package-push-quilt-catalog`}
                  target="_blank"
                >
                  Learn more
                </StyledLink>
                .
              </M.Typography>
            </M.Box>
          ),
        _: () => <MenuPlaceholder />,
        Err: (error: Error) => (
          <M.Box px={2} py={1}>
            <M.Typography gutterBottom>
              Error: <code>{error.message}</code>
            </M.Typography>
            {R.is(ERRORS.WorkflowsConfigInvalid, error) && (
              <M.Typography>
                Please fix the workflows config according to{' '}
                <StyledLink href={`${docs}/advanced/workflows`} target="_blank">
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
