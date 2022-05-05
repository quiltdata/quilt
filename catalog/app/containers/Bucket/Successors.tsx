import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import SelectDropdown from 'components/SelectDropdown'
import { docs } from 'constants/urls'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import StyledLink from 'utils/StyledLink'
import type * as workflows from 'utils/workflows'

import * as ERRORS from './errors'
import * as requests from './requests'

function EmptySlot() {
  return (
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
  )
}

interface ErrorSlotProps {
  error: Error
}

function ErrorSlot({ error }: ErrorSlotProps) {
  return (
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
  )
}

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

function useSuccessors(
  bucket: string,
  { noAutoFetch = false },
): workflows.Successor[] | Error | undefined {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket }, { noAutoFetch })
  return React.useMemo(
    () =>
      data.case({
        Ok: ({ successors }: { successors: workflows.Successor[] }) => successors,
        Err: (error: Error) => error,
        _: () => undefined,
      }),
    [data],
  )
}

interface SuccessorsSelectProps {
  anchorEl: HTMLElement | null
  bucket: string
  onChange: (x: workflows.Successor) => void
  onClose: () => void
  open: boolean
}

export default function SuccessorsSelect({
  anchorEl,
  bucket,
  onChange,
  onClose,
  open,
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

interface InputProps {
  bucket: string
  className?: string
  onChange?: (value: workflows.Successor) => void
  successor: workflows.Successor
}

export function Input({ bucket, className, onChange, successor }: InputProps) {
  const [open, setOpen] = React.useState(false)
  const [noAutoFetch, setNoAutoFetch] = React.useState(true)
  const successors = useSuccessors(bucket, { noAutoFetch })
  const options = React.useMemo(() => {
    if (!Array.isArray(successors)) return []
    return successors.map((s) => ({
      ...s,
      valueOf: () => s.slug,
      toString: () => s.slug,
    }))
  }, [successors])
  const handleClose = React.useCallback(() => setOpen(false), [])
  const handleOpen = React.useCallback(() => {
    setOpen(true)
    setNoAutoFetch(false)
  }, [])
  const handleChange = React.useCallback(
    ({ valueOf, toString, ...s }) => {
      if (onChange) onChange(s)
    },
    [onChange],
  )
  const emptySlot = React.useMemo(
    () =>
      successors instanceof Error ? <ErrorSlot error={successors} /> : <EmptySlot />,
    [successors],
  )
  const loading = !successors && open
  return (
    <SelectDropdown
      className={className}
      disabled={!onChange || (Array.isArray(successors) && !successors?.length)}
      loading={loading}
      onChange={handleChange}
      onClose={handleClose}
      onOpen={handleOpen}
      options={options}
      value={successor.slug}
      emptySlot={emptySlot}
    />
  )
}

interface ButtonProps {
  children: string
  className: string
  onClick: React.MouseEventHandler<HTMLButtonElement>
}

function Button({ children, className, onClick }: ButtonProps) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  return sm ? (
    <M.IconButton
      aria-haspopup
      className={className}
      edge="end"
      onClick={onClick}
      size="small"
      title={children}
    >
      <M.Icon>exit_to_app</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button
      aria-haspopup
      className={className}
      onClick={onClick}
      size="small"
      variant="outlined"
    >
      {children}
    </M.Button>
  )
}

interface CopyButtonProps {
  bucket: string
  className: string
  children: string
  onChange: (s: workflows.Successor) => void
}

export function CopyButton({ bucket, className, children, onChange }: CopyButtonProps) {
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
      <Button className={className} onClick={onButtonClick}>
        {children}
      </Button>

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
