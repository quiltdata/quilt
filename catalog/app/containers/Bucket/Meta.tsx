import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import type { JsonRecord } from 'utils/types'

import * as requests from './requests'
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

interface PackageMetaSectionProps {
  meta: MetaData
  preferences: BucketPreferences.MetaBlockPreferences
}

function PackageMetaSection({ meta, preferences }: PackageMetaSectionProps) {
  const classes = usePackageMetaStyles()
  const { message, user_meta: userMeta, workflow } = meta
  return (
    <Section icon="list" heading="Metadata" defaultExpanded>
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
                <JsonDisplay
                  defaultExpanded={preferences.userMeta.expanded}
                  value={userMeta}
                />
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
                <JsonDisplay
                  defaultExpanded={preferences.workflows.expanded}
                  value={workflow}
                />
              </M.TableCell>
            </M.TableRow>
          )}
        </M.TableBody>
      </M.Table>
    </Section>
  )
}

interface PackageMetaProps {
  data: MetaData | null
}

export function PackageMeta({ data }: PackageMetaProps) {
  const prefs = BucketPreferences.use()
  if (!data || R.isEmpty(data)) return null
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { blocks } }) =>
        blocks.meta ? <PackageMetaSection meta={data} preferences={blocks.meta} /> : null,
      _: noop,
    },
    prefs,
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

interface ObjectTagsSectionProps {
  tags: requests.ObjectTags
}

function ObjectTagsSection({ tags }: ObjectTagsSectionProps) {
  return (
    <Section icon="label_outlined" heading="S3 Object Tags" defaultExpanded>
      {/* @ts-expect-error */}
      <JsonDisplay value={tags} defaultExpanded={1} />
    </Section>
  )
}

interface ObjectTagsProps {
  handle: Model.S3.S3ObjectLocation
}

export function ObjectTags({ handle }: ObjectTagsProps) {
  const s3 = AWS.S3.use()
  const tagsData = useData(requests.objectTags, {
    s3,
    handle,
  })

  return tagsData.case({
    Ok: (tags?: requests.ObjectTags) => {
      if (!tags) return null
      return <ObjectTagsSection tags={tags} />
    },
    Err: errorHandler,
    _: noop,
  })
}
