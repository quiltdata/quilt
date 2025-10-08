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
  base: PackageHandle
  other: PackageHandle
  changesOnly: boolean
  onChangesOnly: (changesOnly: boolean) => void
  onBaseChange: (hash: string) => void
  onOtherChange: (hash: string) => void
  onSwap: () => void
}

export function RevisionsCompare({
  base,
  other,
  changesOnly,
  onChangesOnly,
  onBaseChange,
  onOtherChange,
  onSwap,
}: RevisionsCompareProps) {
  const classes = useStyles()

  const baseRevisionResult = useRevision(base.bucket, base.name, base.hash)
  const otherRevisionResult = useRevision(other.bucket, other.name, other.hash)

  return (
    <div className={classes.root}>
      <RevisionsRange
        base={base}
        other={other}
        onBaseChange={onBaseChange}
        onOtherChange={onOtherChange}
        onSwap={onSwap}
      />

      <div className={classes.summary}>
        <M.Typography variant="h6" gutterBottom>
          What's changed
        </M.Typography>
        <Diff.Summary base={baseRevisionResult} other={otherRevisionResult} />
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
            base={baseRevisionResult}
            other={otherRevisionResult}
            changesOnly={changesOnly}
          />
        </M.Paper>
      </div>

      <div className={classes.entries}>
        <M.Typography variant="subtitle1" gutterBottom>
          Entries
        </M.Typography>
        <Diff.Entries
          base={baseRevisionResult}
          other={otherRevisionResult}
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
              base={base}
              other={other}
              onBaseChange={changeBase}
              onOtherChange={changeOther}
              onChangesOnly={toggleChangesOnly}
              onSwap={swap}
            />
          ) : (
            <RevisionsRange
              base={base}
              other={other}
              onBaseChange={changeBase}
              onOtherChange={changeOther}
              onSwap={swap}
            />
          )}
        </FileView.Root>
      </WithPackagesSupport>
    </>
  )
}
