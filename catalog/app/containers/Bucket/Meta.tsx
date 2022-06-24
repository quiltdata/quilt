import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import AsyncResult from 'utils/AsyncResult'
import { Json } from 'utils/types'

import Section, { SectionProps } from './Section'

interface MetaData {
  message: string
  user_meta?: object
  workflow?: $TSFixMe
  version?: $TSFixMe
}

const useHeadCellStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(1),
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
}))

interface HeadCellProps {
  children: React.ReactNode
  className?: string
  title: string
}

const HeadCell = ({ className, children, title }: HeadCellProps) => {
  const classes = useHeadCellStyles()
  return (
    <M.TableCell className={cx(classes.root, className)} component="th" scope="row">
      <M.Tooltip title={title}>
        <span>{children}</span>
      </M.Tooltip>
    </M.TableCell>
  )
}

const useMetaStyles = M.makeStyles({
  cell: {
    width: '100%',
  },
  message: {
    paddingLeft: '4px',
  },
  row: {
    '&:last-child th, &:last-child td': {
      borderBottom: 0,
    },
    '&:only-child th': {
      paddingLeft: 0,
    },
  },
  wrapper: {
    width: '100%',
  },
})

interface PackageMetaProps {
  meta: MetaData
}

function PackageMeta({ meta }: PackageMetaProps) {
  const classes = useMetaStyles()

  const { message, user_meta: userMeta, workflow } = meta

  return (
    <M.Table size="small">
      <M.TableBody>
        {message && (
          <M.TableRow className={classes.row}>
            <HeadCell title="/message">Message:</HeadCell>
            <M.TableCell className={classes.cell}>
              <M.Typography className={classes.message}>{message}</M.Typography>
            </M.TableCell>
          </M.TableRow>
        )}
        {userMeta && (
          <M.TableRow className={classes.row}>
            <HeadCell title="/user_metadata">User metadata:</HeadCell>
            <M.TableCell className={classes.cell}>
              {/* @ts-expect-error */}
              <JsonDisplay value={userMeta} />
            </M.TableCell>
          </M.TableRow>
        )}
        {workflow && (
          <M.TableRow className={classes.row}>
            <HeadCell title="/workflow">Workflow:</HeadCell>
            <M.TableCell className={classes.cell}>
              {/* @ts-expect-error */}
              <JsonDisplay value={workflow} />
            </M.TableCell>
          </M.TableRow>
        )}
      </M.TableBody>
    </M.Table>
  )
}

interface ObjectMetaProps {
  meta: Json
}

function ObjectMeta({ meta }: ObjectMetaProps) {
  console.log('ObjectMeta', meta)
  // @ts-expect-error
  return <JsonDisplay value={meta} defaultExpanded={1} />
}

interface MetaWrapperProps extends Partial<SectionProps> {
  data: $TSFixMe
}

export function Package({ data, ...props }: MetaWrapperProps) {
  return AsyncResult.case(
    {
      Ok: (meta: MetaData) => (
        <Section icon="list" heading="Metadata" defaultExpanded {...props}>
          <PackageMeta meta={meta} />
        </Section>
      ),
      _: () => null,
    },
    data,
  )
}

export function Object({ data, ...props }: MetaWrapperProps) {
  return AsyncResult.case(
    {
      Ok: (meta: Json) =>
        meta && !R.isEmpty(meta) ? (
          <Section icon="list" heading="Metadata" defaultExpanded {...props}>
            <ObjectMeta meta={meta} />
          </Section>
        ) : null,
      _: () => null,
    },
    data,
  )
}
