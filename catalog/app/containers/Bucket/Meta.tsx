import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import type { MetaBlockPreferences } from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import type { JsonRecord } from 'utils/types'

import * as requests from './requests'
import Section from './Section'

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

interface PackageMetaSectionProps {
  meta: MetaData | null
  preferences: MetaBlockPreferences
}

export function PackageMetaSection({ meta, preferences }: PackageMetaSectionProps) {
  const classes = usePackageMetaStyles()
  if (!meta || R.isEmpty(meta)) return null
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

interface ObjectMetaSectionProps {
  meta?: JsonRecord
}

export function ObjectMetaSection({ meta }: ObjectMetaSectionProps) {
  if (!meta || R.isEmpty(meta)) return null
  return (
    <Section icon="list" heading="Metadata" defaultExpanded>
      {/* @ts-expect-error */}
      <JsonDisplay value={meta} defaultExpanded={1} />
    </Section>
  )
}

interface ObjectMetaProps {
  handle: Model.S3.S3ObjectLocation
}

export function ObjectMeta({ handle }: ObjectMetaProps) {
  const s3 = AWS.S3.use()
  const metaData = useData(requests.objectMeta, {
    s3,
    handle,
  })
  return metaData.case({
    Ok: (meta?: JsonRecord) => <ObjectMetaSection meta={meta} />,
    Err: errorHandler,
    _: noop,
  })
}

interface ObjectTagsSectionProps {
  tags?: requests.ObjectTags
  preferences: MetaBlockPreferences
}

function ObjectTagsSection({ preferences, tags }: ObjectTagsSectionProps) {
  if (!tags) return null
  return (
    <Section icon="label_outlined" heading="S3 Object Tags" defaultExpanded>
      {/* @ts-expect-error */}
      <JsonDisplay value={tags} defaultExpanded={preferences.tags.expanded} />
    </Section>
  )
}

interface ObjectTagsProps {
  handle: Model.S3.S3ObjectLocation
  preferences: MetaBlockPreferences
}

export function ObjectTags({ handle, preferences }: ObjectTagsProps) {
  const s3 = AWS.S3.use()
  const tagsData = useData(requests.objectTags, {
    s3,
    handle,
  })
  return tagsData.case({
    Ok: (tags?: requests.ObjectTags) => (
      <ObjectTagsSection tags={tags} preferences={preferences} />
    ),
    Err: errorHandler,
    _: noop,
  })
}
