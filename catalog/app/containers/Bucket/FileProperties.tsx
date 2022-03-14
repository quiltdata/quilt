import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import { readableBytes } from 'utils/string'

import * as requests from './requests'

interface FilePropertyProps extends M.TypographyProps {
  children: React.ReactNode
  className: string
}

const useFilePropertyStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'inline-flex',
  },
  icon: {
    color: t.palette.text.hint,
    fontSize: 16,
    marginRight: '2px',
  },
}))

function FileProperty({ className, children, ...props }: FilePropertyProps) {
  const classes = useFilePropertyStyles()
  return (
    <M.Typography
      className={cx(classes.root, className)}
      component="span"
      variant="body2"
      {...props}
    >
      {children}
    </M.Typography>
  )
}

function FilePropertiesSkeleton({ className }: { className: string }) {
  const classes = useFilePropertiesStyles()
  return (
    <div className={cx(classes.root, className)}>
      <Skeleton animate className={classes.property} width="80px" height="14px" />
      <Skeleton animate className={classes.property} width="80px" height="14px" />
    </div>
  )
}

interface FilePropertiesProps {
  data: $TSFixMe
  className: string
}

const useFilePropertiesStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  property: {
    marginLeft: t.spacing(1),
  },
}))

interface FilePropertiesBareProps {
  className?: string
  lastModified?: Date
  size?: number
}

export function FileProperties({
  className,
  lastModified,
  size,
}: FilePropertiesBareProps) {
  const classes = useFilePropertiesStyles()

  const today = React.useMemo(() => new Date(), [])
  const formattedDate = React.useMemo(
    () =>
      lastModified
        ? dateFns.format(
            lastModified,
            today.getFullYear() === lastModified.getFullYear() ? 'd MMM' : 'd MMM yyyy',
          )
        : null,
    [lastModified, today],
  )
  const formattedSize = React.useMemo(() => readableBytes(size), [size])

  return (
    <div className={cx(classes.root, className)}>
      {formattedDate && (
        <FileProperty title={lastModified?.toLocaleString()} className={classes.property}>
          {formattedDate}
        </FileProperty>
      )}
      <FileProperty className={classes.property}>{formattedSize}</FileProperty>
    </div>
  )
}

export default function Wrapper({ className, data }: FilePropertiesProps) {
  const classes = useFilePropertiesStyles()
  return (
    <div className={cx(classes.root, className)}>
      {data.case({
        Ok: requests.ObjectExistence.case({
          Exists: ({ lastModified, size }: { lastModified?: Date; size?: number }) => (
            <FileProperties {...{ className, lastModified, size }} />
          ),
          _: () => <FilePropertiesSkeleton className={className} />,
        }),
        Err: (e: Error) => (
          <M.Icon title={`Fetching object info failed: ${e.message}`} color="error">
            warning_outline
          </M.Icon>
        ),
        _: () => <FilePropertiesSkeleton className={className} />,
      })}
    </div>
  )
}
