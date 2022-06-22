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
      {error instanceof ERRORS.WorkflowsConfigInvalid && (
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

const useMenuPlaceholderStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(22),
  },
  item: {
    height: t.spacing(6),
    width: '100%',
  },
}))

function MenuPlaceholder() {
  const classes = useMenuPlaceholderStyles()
  return (
    <div className={classes.root}>
      <M.MenuItem disabled>
        <Lab.Skeleton className={classes.item} />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton className={classes.item} />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton className={classes.item} />
      </M.MenuItem>
    </div>
  )
}

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

function SuccessorsSelect({
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
              <M.MenuItem key={successor.slug} onClick={() => onChange(successor)}>
                <M.ListItemText primary={successor.name} secondary={successor.url} />
              </M.MenuItem>
            ))
          ) : (
            <EmptySlot />
          ),
        _: () => <MenuPlaceholder />,
        Err: (error: Error) => <ErrorSlot error={error} />,
      })}
    </M.Menu>
  )
}

const useButtonStyles = M.makeStyles({
  root: {
    font: 'inherit',
  },
})

interface InputProps {
  bucket: string
  className?: string
  onChange?: (value: workflows.Successor) => void
  successor: workflows.Successor
}

export function Dropdown({ bucket, className, onChange, successor }: InputProps) {
  const [open, setOpen] = React.useState(false)
  const [noAutoFetch, setNoAutoFetch] = React.useState(true)
  const successors = useSuccessors(bucket, { noAutoFetch })
  const options = React.useMemo(
    () =>
      Array.isArray(successors)
        ? successors.map((s) => ({
            ...s,
            valueOf: () => s.slug,
            toString: () => s.slug,
          }))
        : [],
    [successors],
  )
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

  const buttonClasses = useButtonStyles()
  const ButtonProps = React.useMemo(
    () =>
      ({
        className: buttonClasses.root,
        variant: 'text',
      } as M.ButtonProps),
    [buttonClasses],
  )
  return (
    <SelectDropdown
      ButtonProps={ButtonProps}
      className={className}
      disabled={!onChange || (Array.isArray(successors) && !successors?.length)}
      emptySlot={emptySlot}
      loading={loading}
      onChange={handleChange}
      onClose={handleClose}
      onOpen={handleOpen}
      options={options}
      value={successor.slug}
    />
  )
}

interface ButtonInnerProps {
  children: string
  className: string
  onClick: React.MouseEventHandler<HTMLButtonElement>
}

function ButtonInner({ children, className, onClick }: ButtonInnerProps) {
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

interface ButtonProps {
  bucket: string
  className: string
  children: string
  onChange: (s: workflows.Successor) => void
}

export function Button({ bucket, className, children, onChange }: ButtonProps) {
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
      <ButtonInner className={className} onClick={onButtonClick}>
        {children}
      </ButtonInner>

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
