import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'
import useQuery from 'utils/useQuery'

import POLICIES_QUERY from './gql/Policies.generated'

const useStyles = M.makeStyles((t) => ({
  heading: {
    alignItems: 'center',
    display: 'flex',
  },
  icon: {
    marginLeft: t.spacing(0.5),
  },
  cell: {
    minWidth: t.spacing(17.5),
  },
  container: {
    borderBottom: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(1),
    maxHeight: 'calc(100vh - 500px)',
  },
}))

interface AssociatedPoliciesProps extends RF.FieldRenderProps<string[]> {
  className?: string
  policyTitles?: Record<string, string>
  onAdvanced?: () => void
  errors: Record<string, React.ReactNode>
}

export default function AssociatedPolicies({
  className,
  input: { value, onChange },
  meta,
  policyTitles = {},
  errors,
  onAdvanced,
}: AssociatedPoliciesProps) {
  const classes = useStyles()

  const policiesData = useQuery({ query: POLICIES_QUERY })

  const [anchorEl, setAnchorEl] = React.useState<Element | null>(null)

  const error = meta.submitFailed && (meta.error || meta.submitError)

  const handleOpen = React.useCallback(
    (e: React.MouseEvent) => {
      setAnchorEl(e.currentTarget)
    },
    [setAnchorEl],
  )

  const handleClose = React.useCallback(() => {
    setAnchorEl(null)
  }, [setAnchorEl])

  const handleAdd = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const policyId = e.currentTarget.dataset.policy
      if (policyId) onChange(value.concat([policyId]))
      handleClose()
    },
    [value, onChange, handleClose],
  )

  const handleRemove = React.useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const policyId = e.currentTarget.dataset.policy
      if (policyId) onChange(R.without([policyId], value))
    },
    [value, onChange],
  )

  return (
    <div className={className}>
      <div className={classes.heading}>
        <M.Typography variant="h6">Associated policies</M.Typography>
        <M.Tooltip arrow title={<>TBD</>}>
          <M.Icon fontSize="small" color="disabled" className={classes.icon}>
            info_outlined
          </M.Icon>
        </M.Tooltip>
      </div>
      {!!onAdvanced && (
        <M.FormHelperText>
          Manage access by combining reusable policies or{' '}
          <StyledLink onClick={onAdvanced}>set existing role via ARN</StyledLink>
        </M.FormHelperText>
      )}
      <M.Collapse in={!!error}>
        <M.FormHelperText error>{error ? errors[error] || error : ' '}</M.FormHelperText>
      </M.Collapse>

      {/* TODO: sort? */}
      <M.TableContainer className={classes.container}>
        <M.Table stickyHeader size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell className={classes.cell}>Policy title</M.TableCell>
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {value.map((policyId) => (
              <M.TableRow key={policyId}>
                <M.TableCell>
                  {policyTitles[policyId] ||
                    policiesData.case({
                      fetching: () => policyId,
                      error: () => policyId,
                      data: (d) =>
                        d.policies.find((r) => r.id === policyId)?.title || policyId,
                    })}
                  <M.Button data-policy={policyId} onClick={handleRemove}>
                    Remove
                  </M.Button>
                </M.TableCell>
              </M.TableRow>
            ))}
            <M.TableRow>
              <M.TableCell>
                <M.Button onClick={handleOpen}>+ Add policy</M.Button>
                <M.Menu
                  anchorEl={anchorEl}
                  keepMounted
                  open={!!anchorEl}
                  onClose={handleClose}
                >
                  {policiesData.case({
                    // TODO: nicer fetching and error states
                    fetching: () => (
                      <M.MenuItem onClick={handleClose}>FETCHING</M.MenuItem>
                    ),
                    data: ({ policies }) => {
                      const filtered = policies.filter((p) => !value.includes(p.id))
                      return filtered.length ? (
                        filtered.map((p) => (
                          <M.MenuItem key={p.id} data-policy={p.id} onClick={handleAdd}>
                            {p.title}
                          </M.MenuItem>
                        ))
                      ) : (
                        <M.MenuItem onClick={handleClose}>No more policies</M.MenuItem>
                      )
                    },
                    error: (e) => (
                      <M.MenuItem onClick={handleClose} title={e.message}>
                        ERROR
                      </M.MenuItem>
                    ),
                  })}
                </M.Menu>
              </M.TableCell>
            </M.TableRow>
          </M.TableBody>
        </M.Table>
      </M.TableContainer>
    </div>
  )
}
