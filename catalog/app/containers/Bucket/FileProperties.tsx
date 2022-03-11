import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import { readableBytes } from 'utils/string'

import * as requests from './requests'

interface FilePropertyProps {
  className: string
  iconName: string
  children: React.ReactNode
}

const useFilePropertyStyles = M.makeStyles((t) => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  icon: {
    marginRight: '2px',
    fontSize: 16,
    color: t.palette.text.hint,
  },
}))

function FileProperty({ className, iconName, children }: FilePropertyProps) {
  const classes = useFilePropertyStyles()
  return (
    <M.Typography
      variant="body2"
      component="span"
      className={cx(classes.root, className)}
    >
      <M.Icon className={classes.icon}>{iconName}</M.Icon>
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
    display: 'flex',
    alignItems: 'center',
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
function FileProperties({ className, lastModified, size }: FilePropertiesBareProps) {
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
    [lastModified],
  )
  const formattedSize = React.useMemo(() => readableBytes(size), [size])

  return (
    <div className={cx(classes.root, className)}>
      <FileProperty className={classes.property} iconName="insert_drive_file_outlined">
        {formattedSize}
      </FileProperty>
      {lastModified && (
        <FileProperty className={classes.property} iconName="date_range_outlined">
          {formattedDate}
        </FileProperty>
      )}
    </div>
  )
}

export const Container = FileProperties

// TODO: rename to wrapper
export function Wrapper({ className, data }: FilePropertiesProps) {
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
        Err: (e: Error) => e.message,
        _: () => <FilePropertiesSkeleton className={className} />,
      })}
    </div>
  )
}
