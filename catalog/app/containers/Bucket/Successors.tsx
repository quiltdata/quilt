import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Buttons from 'components/Buttons'
import { WorkflowsConfigLink } from 'components/FileEditor/HelpLinks'
import SelectDropdown from 'components/SelectDropdown'
import { docs } from 'constants/urls'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import StyledLink from 'utils/StyledLink'
import * as workflows from 'utils/workflows'

import * as ERRORS from './errors'
import * as requests from './requests'

function EmptySlot() {
  return (
    <M.Box px={2} py={1}>
      <M.Typography gutterBottom>
        Add or update a <WorkflowsConfigLink>config.yml</WorkflowsConfigLink> file to
        populate this menu.
      </M.Typography>
      <M.Typography>
        <StyledLink
          href={`${docs}/workflows#cross-bucket-package-push-quilt-catalog`}
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
          <StyledLink href={`${docs}/workflows`} target="_blank">
            the documentation
          </StyledLink>
        </M.Typography>
      )}
    </M.Box>
  )
}

const useMenuPlaceholderStyles = M.makeStyles((t) => ({
  item: {
    height: t.spacing(6),
    minWidth: t.spacing(22),
    width: '100%',
  },
}))

function MenuPlaceholder() {
  const classes = useMenuPlaceholderStyles()
  return (
    <>
      <M.MenuItem disabled>
        <Lab.Skeleton className={classes.item} />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton className={classes.item} />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton className={classes.item} />
      </M.MenuItem>
    </>
  )
}

function useSuccessors(
  bucket: string,
  {
    currentBucketCanBeSuccessor,
    noAutoFetch = false,
  }: { currentBucketCanBeSuccessor: boolean; noAutoFetch?: boolean },
): workflows.Successor[] | Error | undefined {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket }, { noAutoFetch })
  return React.useMemo(
    () =>
      data.case({
        Ok: ({ successors }: { successors: workflows.Successor[] }) =>
          currentBucketCanBeSuccessor && !successors.find(({ slug }) => slug === bucket)
            ? [workflows.bucketToSuccessor(bucket), ...successors]
            : successors,
        Err: (error: Error) => error,
        _: () => undefined,
      }),
    [bucket, currentBucketCanBeSuccessor, data],
  )
}

const ANCHOR_ORIGIN = { vertical: 'bottom', horizontal: 'left' } as const

interface SuccessorsSelectProps {
  anchorEl: HTMLElement | null
  onChange: (x: workflows.Successor) => void
  onClose: () => void
  successors: workflows.Successor[] | Error | undefined
}

export function SuccessorsSelect({
  anchorEl,
  onChange,
  onClose,
  successors,
}: SuccessorsSelectProps) {
  const open = !!anchorEl

  if (successors instanceof Error) {
    return (
      <M.Popover
        anchorEl={anchorEl}
        onClose={onClose}
        open={open}
        anchorOrigin={ANCHOR_ORIGIN}
      >
        <ErrorSlot error={successors} />
      </M.Popover>
    )
  }

  if (!successors) {
    return (
      <M.Menu anchorEl={anchorEl} onClose={onClose} open={open}>
        <MenuPlaceholder />
      </M.Menu>
    )
  }

  if (!successors.length) {
    return (
      <M.Popover
        anchorEl={anchorEl}
        onClose={onClose}
        open={open}
        anchorOrigin={ANCHOR_ORIGIN}
      >
        <EmptySlot />
      </M.Popover>
    )
  }

  return (
    <M.Menu anchorEl={anchorEl} onClose={onClose} open={open}>
      <M.ListSubheader>Destination bucket</M.ListSubheader>
      {successors.map((successor) => (
        <M.MenuItem key={successor.slug} onClick={() => onChange(successor)}>
          {successor.name !== successor.slug ? (
            <M.ListItemText primary={successor.name} secondary={successor.url} />
          ) : (
            <M.ListItemText primary={successor.url} />
          )}
        </M.MenuItem>
      ))}
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
  currentBucketCanBeSuccessor: boolean
  onChange?: (value: workflows.Successor) => void
  successor: workflows.Successor
}

export function Dropdown({
  bucket,
  className,
  currentBucketCanBeSuccessor,
  onChange,
  successor,
}: InputProps) {
  const [open, setOpen] = React.useState(false)
  const [noAutoFetch, setNoAutoFetch] = React.useState(true)
  const successors = useSuccessors(bucket, { currentBucketCanBeSuccessor, noAutoFetch })
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
      }) as M.ButtonProps,
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

interface ButtonProps extends Omit<M.IconButtonProps, 'onChange' | 'variant'> {
  bucket: string
  currentBucketCanBeSuccessor?: boolean
  icon?: string
  className: string
  children: string
  onChange: (s: workflows.Successor) => void
  variant?: 'text' | 'outlined' | 'contained'
}

export function Button({
  bucket,
  className,
  children,
  currentBucketCanBeSuccessor = false,
  icon,
  onChange,
  ...props
}: ButtonProps) {
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const successors = useSuccessors(bucket, { currentBucketCanBeSuccessor })

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
      {icon ? (
        <Buttons.Iconized
          className={className}
          icon={icon}
          label={children}
          onClick={onButtonClick}
          {...props}
        />
      ) : (
        <M.Button className={className} onClick={onButtonClick} size="small" {...props}>
          {children}
        </M.Button>
      )}

      <SuccessorsSelect
        anchorEl={menuAnchorEl}
        onChange={onMenuClick}
        onClose={onMenuClose}
        successors={successors}
      />
    </>
  )
}
