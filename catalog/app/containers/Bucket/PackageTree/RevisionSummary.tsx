import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as NamedRoutes from 'utils/NamedRoutes'

import Summary from '../PackageCompare/Diff/Summary'
import useRevisions from '../PackageCompare/useRevisionsPair'

const useDiffSummaryStyles = M.makeStyles((t) => ({
  popover: {
    width: t.spacing(60),
  },
  header: {
    padding: t.spacing(2, 2, 1),
    borderBottom: `1px solid ${t.palette.divider}`,
  },
  content: {
    padding: t.spacing(1, 2, 2),
    maxHeight: '60vh',
    overflow: 'auto',
  },
  showMore: {
    padding: t.spacing(1, 2),
    borderTop: `1px solid ${t.palette.divider}`,
  },
}))

interface DiffSummaryProps {
  bucket: string
  name: string
  hashes: [string, string]
  onClose: () => void
}

function DiffSummary({ bucket, name, hashes: [base, other], onClose }: DiffSummaryProps) {
  const classes = useDiffSummaryStyles()
  const { urls } = NamedRoutes.use()

  const revisionsResult = useRevisions([
    { bucket, name, hash: base },
    { bucket, name, hash: other },
  ])

  return (
    <div className={classes.popover}>
      <div className={classes.header}>
        <M.Typography variant="subtitle1">What's changed</M.Typography>
      </div>
      <div className={classes.content}>
        <Summary revisionsResult={revisionsResult} />
      </div>
      <div className={classes.showMore}>
        <M.Button
          component={RRLink}
          to={urls.bucketPackageCompare(bucket, name, base, other)}
          onClick={onClose}
          size="small"
        >
          View detailed comparison
        </M.Button>
      </div>
    </div>
  )
}

interface SummaryButtonProps {
  bucket: string
  name: string
  hashes: [string, string]
  className?: string
}

export default function SummaryButton({
  bucket,
  name,
  hashes,
  className,
}: SummaryButtonProps) {
  const [anchor, setAnchor] = React.useState<HTMLButtonElement | null>(null)
  const [opened, setOpened] = React.useState(false)

  const open = React.useCallback(() => setOpened(true), [])
  const close = React.useCallback(() => setOpened(false), [])

  return (
    <>
      <M.IconButton
        className={className}
        size="small"
        title="What's changed"
        onClick={open}
        ref={setAnchor}
      >
        <Icons.CompareArrows />
      </M.IconButton>

      <M.Popover open={opened && !!anchor} anchorEl={anchor} onClose={close}>
        <DiffSummary bucket={bucket} name={name} hashes={hashes} onClose={close} />
      </M.Popover>
    </>
  )
}
