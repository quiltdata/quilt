import * as React from 'react'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type { PackageHandle } from 'utils/packageHandle'

import * as FileView from '../FileView'
import WithPackagesSupport from '../WithPackagesSupport'

import * as Diff from './Diff'
import RevisionsRange from './RevisionsRange'
import { useRevision } from './useRevision'
import useRouter from './router'

interface PackageNameProps {
  bucket: string
  name: string
}

function PackageName({ bucket, name }: PackageNameProps) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Typography variant="body1" gutterBottom>
      <StyledLink to={urls.bucketPackageDetail(bucket, name)}>{name}</StyledLink>
    </M.Typography>
  )
}

interface ChangesOnlyCheckboxProps {
  value: boolean
  onChange: (checked: boolean) => void
}

function ChangesOnlyCheckbox({ onChange, value }: ChangesOnlyCheckboxProps) {
  const handleChange = React.useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, checked) => onChange(checked),
    [onChange],
  )
  return (
    <M.FormControlLabel
      control={<M.Checkbox checked={value} onChange={handleChange} />}
      label="Show changes only"
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {},
  table: {
    marginTop: t.spacing(1),
  },
  summary: {
    marginTop: t.spacing(4),
  },
  details: {
    marginTop: t.spacing(4),
    display: 'flex',
    justifyContent: 'space-between',
  },
  userMeta: {},
  entries: {
    marginTop: t.spacing(4),
  },
}))

interface RevisionsCompareProps {
  left: PackageHandle
  right: PackageHandle
  changesOnly: boolean
  onChangesOnly: (changesOnly: boolean) => void
  onLeftChange: (hash: string) => void
  onRightChange: (hash: string) => void
  onSwap: () => void
}

export function RevisionsCompare({
  left,
  right,
  changesOnly,
  onChangesOnly,
  onLeftChange,
  onRightChange,
  onSwap,
}: RevisionsCompareProps) {
  const classes = useStyles()

  const leftRevisionResult = useRevision(left.bucket, left.name, left.hash)
  const rightRevisionResult = useRevision(right.bucket, right.name, right.hash)

  return (
    <div className={classes.root}>
      <RevisionsRange
        left={left}
        right={right}
        onLeftChange={onLeftChange}
        onRightChange={onRightChange}
        onSwap={onSwap}
      />

      <div className={classes.summary}>
        <M.Typography variant="h6" gutterBottom>
          What's changed
        </M.Typography>
        <Diff.Summary left={leftRevisionResult} right={rightRevisionResult} />
      </div>

      <M.Typography variant="h6" gutterBottom className={classes.details}>
        Details
        <ChangesOnlyCheckbox value={changesOnly} onChange={onChangesOnly} />
      </M.Typography>

      <div className={classes.userMeta}>
        <M.Typography variant="subtitle1" gutterBottom>
          User metadata
        </M.Typography>
        <M.Paper square variant="outlined">
          <Diff.Metadata
            left={leftRevisionResult}
            right={rightRevisionResult}
            changesOnly={changesOnly}
          />
        </M.Paper>
      </div>

      <div className={classes.entries}>
        <M.Typography variant="subtitle1" gutterBottom>
          Entries
        </M.Typography>
        <Diff.Entries
          left={leftRevisionResult}
          right={rightRevisionResult}
          changesOnly={changesOnly}
        />
      </div>
    </div>
  )
}

export default function PackageCompareWrapper() {
  const {
    bucket,
    name,

    base,
    other,

    changeBase,
    changeOther,
    swap,

    changesOnly,
    toggleChangesOnly,
  } = useRouter()

  return (
    <>
      <MetaTitle>{[`${name} comparison`, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <FileView.Root>
          <PackageName bucket={bucket} name={name} />
          {other ? (
            <RevisionsCompare
              changesOnly={changesOnly}
              left={base}
              right={other}
              onLeftChange={changeBase}
              onRightChange={changeOther}
              onChangesOnly={toggleChangesOnly}
              onSwap={swap}
            />
          ) : (
            <RevisionsRange
              left={base}
              right={other}
              onLeftChange={changeBase}
              onRightChange={changeOther}
              onSwap={swap}
            />
          )}
        </FileView.Root>
      </WithPackagesSupport>
    </>
  )
}
