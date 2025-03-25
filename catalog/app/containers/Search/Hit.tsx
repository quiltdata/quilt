import cx from 'classnames'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Format from 'utils/format'
import { readableBytes } from 'utils/string'

import * as SearchUIModel from './model'

const useCardStyles = M.makeStyles((t) => ({
  card: {
    display: 'flex',
    flexDirection: 'column',

    '& + &': {
      marginTop: t.spacing(2),
    },
  },
}))

function Card({ children }: React.PropsWithChildren<{}>) {
  const classes = useCardStyles()
  return <M.Paper className={classes.card}>{children}</M.Paper>
}

const useSectionStyles = M.makeStyles((t) => ({
  section: {
    padding: t.spacing(2),
    position: 'relative',
  },
  grow: {
    flexGrow: 1,
  },
  divider: {
    borderTop: `1px solid ${t.palette.divider}`,
  },
}))

function Section({
  children,
  divider = false,
  grow = false,
}: React.PropsWithChildren<{ divider?: boolean; grow?: boolean }>) {
  const classes = useSectionStyles()
  return (
    <div
      className={cx(classes.section, grow && classes.grow, divider && classes.divider)}
    >
      {children}
    </div>
  )
}

const useLinkStyles = M.makeStyles((t) => ({
  link: {},
  text: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: '20px',
    position: 'relative',
  },
  clickArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,

    '$link:hover &': {
      background: t.palette.action.hover,
    },
  },
}))

function Link({ to, children }: { to: string; children: React.ReactNode }) {
  const classes = useLinkStyles()
  return (
    <RR.Link className={classes.link} to={to}>
      <span className={classes.text}>{children}</span>
      <div className={classes.clickArea} />
    </RR.Link>
  )
}

const useSecondaryStyles = M.makeStyles((t) => ({
  secondary: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginTop: t.spacing(1),
  },
}))

function Secondary({ children }: React.PropsWithChildren<{}>) {
  const classes = useSecondaryStyles()
  return <div className={classes.secondary}>{children}</div>
}

const useDividerStyles = M.makeStyles((t) => ({
  divider: {
    marginLeft: t.spacing(0.5),
    marginRight: t.spacing(0.5),
  },
}))

function Divider() {
  const classes = useDividerStyles()
  return <span className={classes.divider}> • </span>
}

interface PackageCardProps
  extends Pick<
    SearchUIModel.SearchHitPackage,
    'bucket' | 'comment' | 'hash' | 'meta' | 'modified' | 'name' | 'size' | 'workflow'
  > {
  showBucket?: boolean
}

export function Package({
  showBucket = false,
  bucket,
  comment,
  // hash,
  meta, // this is actually a string, so we need to parse it
  modified,
  name,
  size,
  workflow,
}: PackageCardProps) {
  const { urls } = NamedRoutes.use()
  // XXX: selective metadata display (like in package list)
  // XXX: link to a specific revision? (by hash)
  // XXX: clickable bucket?
  // XXX: clickable workflow?
  // XXX: hide workflow if only one selected (same as bucket)

  const metaJson = React.useMemo(() => {
    if (!meta) return null
    try {
      return JSON.parse(meta as any)
    } catch {
      return null
    }
  }, [meta])

  return (
    <Card>
      <Section grow>
        <Link to={urls.bucketPackageDetail(bucket, name)}>
          {showBucket && <span>{bucket} / </span>}
          {name}
        </Link>
        <Secondary>
          {readableBytes(size)}
          <Divider />
          Updated <Format.Relative value={modified} />
          {!!workflow?.id && (
            <>
              <Divider /> <span style={{ fontWeight: 500 }}>{workflow.id}</span>
            </>
          )}
        </Secondary>
      </Section>

      {!!comment && (
        <Section divider>
          <M.Typography variant="body2">{comment}</M.Typography>
        </Section>
      )}

      {!!metaJson && (
        <Section divider>
          <JsonDisplay name="Metadata" value={metaJson} />
        </Section>
      )}
    </Card>
  )
}
