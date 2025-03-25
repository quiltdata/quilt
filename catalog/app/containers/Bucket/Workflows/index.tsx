import invariant from 'invariant'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import Placeholder from 'components/Placeholder'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Workflows from 'utils/workflows'

import { displayError } from '../errors'
import * as requests from '../requests'

import Detail from './Detail'
import * as Layout from './Layout'
import List from './List'

const useStyles = M.makeStyles((t) => ({
  chip: {
    marginLeft: t.spacing(2),
  },
}))

interface WorkflowsInnerProps {
  config: Workflows.WorkflowsConfig
  bucket: string
  slug?: string
}

function WorkflowsInner({ config, bucket, slug }: WorkflowsInnerProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()

  const workflows = React.useMemo(
    () => config.workflows.filter((w) => typeof w.slug === 'string'),
    [config.workflows],
  )

  const workflow = React.useMemo(
    () => (slug ? config.workflows.find((w) => w.slug === slug) : undefined),
    [config, slug],
  )

  const root = urls.bucketWorkflowList(bucket)

  const heading = () => {
    if (!slug) return 'Workflows'
    return (
      <>
        <M.IconButton edge="start" to={root} component={RR.Link} size="small">
          <M.Icon>arrow_back</M.Icon>
        </M.IconButton>{' '}
        <M.Box component="span" ml={1}>
          {slug}
          {workflow?.isDefault && (
            <M.Chip
              className={classes.chip}
              label="Default"
              size="small"
              variant="outlined"
            />
          )}
          {workflow?.isDisabled && (
            <M.Chip className={classes.chip} label="Disabled" size="small" />
          )}
        </M.Box>
      </>
    )
  }

  const body = () => {
    if (!workflows.length)
      return <Layout.Message>No workflows configured for this bucket.</Layout.Message>

    if (!slug) return <List bucket={bucket} workflows={workflows} />

    if (!workflow)
      return <Layout.Message>Workflow "{slug}" not found in this bucket.</Layout.Message>

    return <Detail bucket={bucket} workflow={workflow} />
  }

  return (
    <Layout.Container>
      <Layout.Heading>{heading()}</Layout.Heading>
      {body()}
    </Layout.Container>
  )
}

export default function WorkflowsRoot() {
  const { bucket, slug } = RR.useParams<{ bucket: string; slug?: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsConfig, { s3, bucket })

  const title = React.useMemo(() => {
    const segments = ['Workflows', bucket]
    if (slug) segments.unshift(slug)
    return segments
  }, [bucket, slug])

  return (
    <>
      <MetaTitle>{title}</MetaTitle>
      {data.case({
        Ok: (config: Workflows.WorkflowsConfig) => (
          <WorkflowsInner config={config} bucket={bucket} slug={slug} />
        ),
        Err: displayError(),
        _: () => <Placeholder color="text.secondary" />,
      })}
    </>
  )
}
