import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import { readableBytes } from 'utils/string'

import * as requests from './requests'

const today = new Date()
const formatDate = (date?: Date) =>
  date
    ? dateFns.format(
        date,
        today.getFullYear() === date.getFullYear() ? 'd MMM' : 'd MMM yyyy',
      )
    : null

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

function FilePropertiesSkeleton() {
  const classes = useFilePropertiesStyles()
  return (
    <>
      <Skeleton animate className={classes.property} width="80px" height="14px" />
      <Skeleton animate className={classes.property} width="80px" height="14px" />
    </>
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

export default function FileProperties({ className, data }: FilePropertiesProps) {
  const classes = useFilePropertiesStyles()
  return (
    <div className={cx(classes.root, className)}>
      {data.case({
        Ok: requests.ObjectExistence.case({
          Exists: ({ lastModified, size }: { lastModified?: Date; size?: number }) => (
            <>
              <FileProperty
                className={classes.property}
                iconName="insert_drive_file_outlined"
              >
                {readableBytes(size)}
              </FileProperty>
              <FileProperty className={classes.property} iconName="date_range_outlined">
                {formatDate(lastModified)}
              </FileProperty>
            </>
          ),
          _: () => <FilePropertiesSkeleton />,
        }),
        Err: (e: Error) => e.message,
        _: () => <FilePropertiesSkeleton />,
      })}
    </div>
  )
}
