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
import useRevisions from './useRevisionsPair'
import { useRouter, isPair } from './router'

interface PackageNameProps {
  bucket: string
  name: string
}

function PackageName({ bucket, name }: PackageNameProps) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Typography variant="h6">
      Comparing changes in{' '}
      <StyledLink to={urls.bucketPackageDetail(bucket, name)}>{name}</StyledLink>{' '}
      revisions
    </M.Typography>
  )
}

interface ChangesOnlyCheckboxProps {
  className: string
  value: boolean
  onChange: (checked: boolean) => void
}

function ChangesOnlyCheckbox({ className, onChange, value }: ChangesOnlyCheckboxProps) {
  const handleChange = React.useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, checked) => onChange(checked),
    [onChange],
  )
  return (
    <M.FormControlLabel
      className={className}
      control={<M.Checkbox checked={value} onChange={handleChange} />}
      label="Show changes only"
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
  },
  checkbox: {
    marginRight: 0,
  },
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
  bucket: string
  name: string
  pair: [PackageHandle, PackageHandle]
  changesOnly: boolean
  onChangesOnly: (changesOnly: boolean) => void
  onBaseChange: (hash: string) => void
  onOtherChange: (hash: string) => void
  onSwap: () => void
}

export function RevisionsCompare({
  bucket,
  name,
  pair,
  changesOnly,
  onChangesOnly,
  onBaseChange,
  onOtherChange,
  onSwap,
}: RevisionsCompareProps) {
  const classes = useStyles()

  const revisionsResult = useRevisions(pair)

  return (
    <div className={classes.root}>
      <RevisionsRange
        bucket={bucket}
        name={name}
        pair={pair}
        onBaseChange={onBaseChange}
        onOtherChange={onOtherChange}
        onSwap={onSwap}
      />

      <div className={classes.summary}>
        <M.Typography variant="h6" gutterBottom>
          What's changed
        </M.Typography>
        <Diff.Summary revisionsResult={revisionsResult} />
      </div>

      <M.Typography variant="h6" gutterBottom className={classes.details}>
        Details
        <ChangesOnlyCheckbox
          className={classes.checkbox}
          value={changesOnly}
          onChange={onChangesOnly}
        />
      </M.Typography>

      <div className={classes.userMeta}>
        <M.Typography variant="subtitle1" gutterBottom>
          User metadata
        </M.Typography>
        <Diff.Metadata revisionsResult={revisionsResult} changesOnly={changesOnly} />
      </div>

      <div className={classes.entries}>
        <M.Typography variant="subtitle1" gutterBottom>
          Entries
        </M.Typography>
        <Diff.Entries revisionsResult={revisionsResult} changesOnly={changesOnly} />
      </div>
    </div>
  )
}

export default function PackageCompareWrapper() {
  const {
    bucket,
    name,

    pair,

    changeBase,
    changeOther,
    swap,

    changesOnly,
    toggleChangesOnly,
  } = useRouter()

  return (
    <>
      <MetaTitle>{[`Comparing changes in ${name} revisions`, bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <FileView.Root>
          <PackageName bucket={bucket} name={name} />
          {isPair(pair) ? (
            <RevisionsCompare
              bucket={bucket}
              name={name}
              changesOnly={changesOnly}
              pair={pair}
              onBaseChange={changeBase}
              onOtherChange={changeOther}
              onChangesOnly={toggleChangesOnly}
              onSwap={swap}
            />
          ) : (
            <RevisionsRange
              bucket={bucket}
              name={name}
              pair={pair}
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
