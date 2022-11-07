import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import { JsonRecord } from 'utils/types'

import Section, { SectionProps } from './Section'

interface MetaData {
  message?: string
  user_meta?: JsonRecord
  workflow?: JsonRecord
  version?: string
}

const errorHandler = (error: Error) => (
  <Lab.Alert severity="error">{error.message}</Lab.Alert>
)

const noop = () => null

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

const usePackageMetaStyles = M.makeStyles({
  headCell: {
    width: '137px',
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
  table: {
    tableLayout: 'fixed',
    width: '100%',
  },
  wrapper: {
    width: '100%',
  },
})

interface WrapperProps extends Partial<SectionProps> {
  data: $TSFixMe
}

interface PackageMetaProps extends Partial<SectionProps> {
  meta: MetaData
  preferences: BucketPreferences.MetaBlockPreferences | boolean
}

function PackageMetaSection({ meta, preferences, ...props }: PackageMetaProps) {
  const classes = usePackageMetaStyles()
  const { message, user_meta: userMeta, workflow } = meta
  const { user_meta, workflows } =
    typeof preferences === 'object'
      ? preferences
      : ({} as BucketPreferences.MetaBlockPreferences)
  return (
    <Section icon="list" heading="Metadata" defaultExpanded {...props}>
      <M.Table className={classes.table} size="small" data-testid="package-meta">
        <M.TableBody>
          {message && (
            <M.TableRow className={classes.row} data-key="message" data-value={message}>
              <HeadCell className={classes.headCell} title="/message">
                Message:
              </HeadCell>
              <M.TableCell>
                <M.Typography className={classes.message}>{message}</M.Typography>
              </M.TableCell>
            </M.TableRow>
          )}
          {userMeta && (
            <M.TableRow
              className={classes.row}
              data-key="user_meta"
              data-value={JSON.stringify(userMeta)}
            >
              <HeadCell className={classes.headCell} title="/user_meta">
                User metadata:
              </HeadCell>
              <M.TableCell>
                {/* @ts-expect-error */}
                <JsonDisplay defaultExpanded={user_meta?.expanded} value={userMeta} />
              </M.TableCell>
            </M.TableRow>
          )}
          {workflow && (
            <M.TableRow
              className={classes.row}
              data-key="workflow"
              data-value={JSON.stringify(workflow)}
            >
              <HeadCell className={classes.headCell} title="/workflow">
                Workflow:
              </HeadCell>
              <M.TableCell>
                {/* @ts-expect-error */}
                <JsonDisplay defaultExpanded={workflows?.expanded} value={workflow} />
              </M.TableCell>
            </M.TableRow>
          )}
        </M.TableBody>
      </M.Table>
    </Section>
  )
}

export function PackageMeta({ data, ...props }: WrapperProps) {
  const { result } = BucketPreferences.use()
  return AsyncResult.case(
    {
      Ok: (meta?: MetaData) => {
        if (!meta || R.isEmpty(meta)) return null
        return AsyncResult.case(
          {
            Ok: (preferences: BucketPreferences.BucketPreferences) => (
              <PackageMetaSection
                meta={meta}
                preferences={preferences.ui.blocks.meta}
                {...props}
              />
            ),
            Err: errorHandler,
            _: noop,
          },
          result,
        )
      },
      Err: errorHandler,
      _: noop,
    },
    data,
  )
}

interface ObjectMetaProps extends Partial<SectionProps> {
  meta: JsonRecord
}

function ObjectMetaSection({ meta, ...props }: ObjectMetaProps) {
  return (
    <Section icon="list" heading="Metadata" defaultExpanded {...props}>
      {/* @ts-expect-error */}
      <JsonDisplay value={meta} defaultExpanded={1} />
    </Section>
  )
}

export function ObjectMeta({ data, ...props }: WrapperProps) {
  return AsyncResult.case(
    {
      Ok: (meta?: JsonRecord) => {
        if (!meta || R.isEmpty(meta)) return null
        return <ObjectMetaSection meta={meta} {...props} />
      },
      Err: errorHandler,
      _: noop,
    },
    data,
  )
}
