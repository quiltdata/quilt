import * as React from 'react'
import * as M from '@material-ui/core'
import { RestoreOutlined as IconRestoreOutlined } from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'

import type { FormStatus } from '../State/form'
import type { NameState } from '../State/name'
import type { PackageSrc } from '../State/manifest'

interface InputNameProps {
  formStatus: FormStatus
  state: NameState
  setSrc: (src: PackageSrc) => void
}

const usePackageNameWarningStyles = M.makeStyles((t) => ({
  root: {
    marginRight: '4px',
    verticalAlign: '-5px',
  },
  success: {
    color: t.palette.success.main,
  },
  error: {
    color: t.palette.error.main,
  },
  existing: {
    color: t.palette.text.hint,
  },
}))

interface PackageNameWarningProps {
  status: NameState['status']
  setSrc: (src: PackageSrc) => void
}

function PackageNameWarning({ status, setSrc }: PackageNameWarningProps) {
  const classes = usePackageNameWarningStyles()

  switch (status._tag) {
    case 'idle':
      return <></>
    case 'loading':
      return <Lab.Skeleton width={160} />
    case 'new-revision':
      return <span className={classes.existing}>Existing package</span>
    case 'exists':
      return (
        <>
          <IconRestoreOutlined className={classes.root} fontSize="small" />
          Existing package. Want to{' '}
          <StyledLink onClick={() => setSrc(status.dst)}>load and revise it</StyledLink>?
        </>
      )
    case 'new':
      return <span className={classes.success}>New package</span>
    case 'error':
      return <>{status.error.message}</>
    default:
      assertNever(status)
  }
}

/**
 * Package name input field with status display.
 *
 * Shows whether the package name is new or existing, and provides
 * a link to load existing packages for revision.
 */
export default function InputName({
  formStatus,
  state: { value, onChange, status },
  setSrc,
}: InputNameProps) {
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  )
  return (
    <M.TextField
      /*style*/
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      /*constants*/
      helperText={<PackageNameWarning status={status} setSrc={setSrc} />}
      disabled={formStatus._tag === 'submitting'}
      error={status._tag === 'error'}
      label="Name"
      placeholder="e.g. user/package"
      /*data*/
      onChange={handleChange}
      value={value || ''}
    />
  )
}
