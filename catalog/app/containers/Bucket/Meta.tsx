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

const usePackageMetaStyles = M.makeStyles((t) => ({
  headCell: {
    paddingTop: t.spacing(0.25),
    width: '137px',
  },
  cellExpanded: {
    paddingTop: t.spacing(1),
    width: '100%',
  },
  message: {
    paddingLeft: t.spacing(0.5),
  },
  row: {
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexWrap: 'wrap',
    margin: 0,
    padding: t.spacing(0.75, 2),
    '&:last-child': {
      borderBottom: 0,
    },
    '&:only-child dt': {
      paddingLeft: 0,
    },
  },
  table: {
    tableLayout: 'fixed',
    width: '100%',
  },
  valueCell: {
    margin: 0,
  },
  wrapper: {
    width: '100%',
  },
}))

interface WrapperProps extends Partial<SectionProps> {
  data: $TSFixMe
}

interface PackageMetaProps extends Partial<SectionProps> {
  meta: MetaData
  preferences: BucketPreferences.MetaBlockPreferences
}

function PackageMetaSection({ meta, preferences, ...props }: PackageMetaProps) {
  const classes = usePackageMetaStyles()
  const { message, user_meta: userMeta, workflow } = meta
  const [metaExpanded, setMetaExpanded] = React.useState(preferences.userMeta.expanded)
  const [workflowExpanded, setWorkflowExpanded] = React.useState(
    preferences.workflows.expanded,
  )
  const onMetaToggle = React.useCallback(() => setMetaExpanded(R.not), [])
  const onWorkflowToggle = React.useCallback(() => setWorkflowExpanded(R.not), [])
  return (
    <Section icon="list" heading="Metadata" defaultExpanded {...props}>
      <div className={classes.table} data-testid="package-meta">
        {message && (
          <dl className={classes.row} data-key="message" data-value={message}>
            <dt className={classes.headCell} title="/message">
              Message:
            </dt>
            <dd className={classes.valueCell}>
              <M.Typography className={classes.message}>{message}</M.Typography>
            </dd>
          </dl>
        )}
        {userMeta && (
          <dl
            className={classes.row}
            data-key="user_meta"
            data-value={JSON.stringify(userMeta)}
          >
            <dt className={classes.headCell} title="/user_meta">
              User metadata:
            </dt>
            <dd
              className={cx(classes.valueCell, {
                [classes.cellExpanded]: metaExpanded,
              })}
            >
              {/* @ts-expect-error */}
              <JsonDisplay
                defaultExpanded={preferences.userMeta.expanded}
                value={userMeta}
                onToggle={onMetaToggle}
              />
            </dd>
          </dl>
        )}
        {workflow && (
          <dl
            className={classes.row}
            data-key="workflow"
            data-value={JSON.stringify(workflow)}
          >
            <dt className={classes.headCell} title="/workflow">
              Workflow:
            </dt>
            <dd
              className={cx(classes.valueCell, {
                [classes.cellExpanded]: workflowExpanded,
              })}
            >
              {/* @ts-expect-error */}
              <JsonDisplay
                defaultExpanded={preferences.workflows.expanded}
                value={workflow}
                onToggle={onWorkflowToggle}
              />
            </dd>
          </dl>
        )}
      </div>
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
            Ok: (preferences: BucketPreferences.BucketPreferences) =>
              !!preferences.ui.blocks.meta && (
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
