import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'
import useQuery from 'utils/useQuery'

import POLICIES_QUERY from './gql/Policies.generated'
import { PolicySelectionFragment as Policy } from './gql/PolicySelection.generated'

interface PolicySelectionDialogProps {
  open: boolean
  onClose: () => void
  policies: Policy[]
  attachPolicies: (policies: Policy[]) => void
}

function PolicySelectionDialog({
  open,
  onClose,
  policies,
  attachPolicies,
}: PolicySelectionDialogProps) {
  const [selected, setSelected] = React.useState<Policy[]>([])
  const [committed, setCommitted] = React.useState(false)

  const handleExited = React.useCallback(() => {
    if (committed) attachPolicies(selected)
    setCommitted(false)
    setSelected([])
  }, [attachPolicies, committed, selected, setCommitted, setSelected])

  const handleAttach = React.useCallback(() => {
    setCommitted(true)
    onClose()
  }, [onClose, setCommitted])

  const toggle = React.useCallback(
    (policy: Policy) => {
      setSelected((value) =>
        value.includes(policy)
          ? value.filter((p) => p.id !== policy.id)
          : value.concat(policy),
      )
    },
    [setSelected],
  )

  return (
    <M.Dialog maxWidth="xs" open={open} onClose={onClose} onExited={handleExited}>
      <M.DialogTitle>Attach policies</M.DialogTitle>
      <M.DialogContent dividers>
        {policies.length ? (
          policies.map((policy) => (
            <M.FormControlLabel
              key={policy.id}
              style={{ display: 'flex', marginRight: 0 }}
              control={
                <M.Checkbox
                  checked={selected.includes(policy)}
                  onChange={() => toggle(policy)}
                  color="primary"
                />
              }
              label={
                <>
                  {policy.title}
                  <M.Box component="span" color="text.secondary">
                    {' '}
                    (
                    {policy.managed ? (
                      <>{policy.permissions.length} buckets</>
                    ) : (
                      <>unmanaged</>
                    )}
                    )
                  </M.Box>
                </>
              }
            />
          ))
        ) : (
          <M.Typography>No more policies to attach</M.Typography>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button autoFocus onClick={onClose} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={handleAttach} disabled={!selected.length} color="primary">
          Attach
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface AttachedPoliciesProps extends RF.FieldRenderProps<Policy[]> {
  className?: string
  onAdvanced?: () => void
  errors: Record<string, React.ReactNode>
}

export default function AttachedPolicies({
  className,
  input: { value, onChange },
  meta,
  errors,
  onAdvanced,
}: AttachedPoliciesProps) {
  const policiesData = useQuery({ query: POLICIES_QUERY })

  const [policySelectionOpen, setPolicySelectionOpen] = React.useState(false)

  const error = meta.submitFailed && (meta.error || meta.submitError)

  const openPolicySelection = React.useCallback(() => {
    setPolicySelectionOpen(true)
  }, [setPolicySelectionOpen])

  const closePolicySelection = React.useCallback(() => {
    setPolicySelectionOpen(false)
  }, [setPolicySelectionOpen])

  const attachPolicies = React.useCallback(
    (policies: Policy[]) => {
      onChange(value.concat(policies))
    },
    [onChange, value],
  )

  const detachPolicy = (policy: Policy) => {
    onChange(value.filter((p) => p.id !== policy.id))
  }

  const availablePolicies = React.useMemo(
    () =>
      policiesData.case({
        fetching: () => null,
        error: () => null,
        data: ({ policies }) => {
          const ids = value.reduce(
            (acc, { id }) => ({ ...acc, [id]: true }),
            {} as Record<string, boolean>,
          )
          return policies.filter((p) => !ids[p.id])
        },
      }),
    [policiesData, value],
  )

  return (
    <div className={className}>
      <M.Box display="flex" alignItems="center">
        <M.Typography variant="h6">Attached policies</M.Typography>
        {policiesData.case({
          data: () => null,
          fetching: () => (
            <M.Tooltip arrow title="Fetching policies">
              <M.CircularProgress size={20} style={{ opacity: 0.3, marginLeft: '8px' }} />
            </M.Tooltip>
          ),
          error: (e) => (
            <M.Tooltip arrow title={<>Error fetching policies: {e.message}</>}>
              <M.Icon style={{ opacity: 0.3, marginLeft: '8px' }}>error</M.Icon>
            </M.Tooltip>
          ),
        })}
      </M.Box>
      {!!onAdvanced && (
        <M.FormHelperText>
          Manage access by combining reusable policies or{' '}
          <StyledLink onClick={onAdvanced}>set existing role via ARN</StyledLink>
        </M.FormHelperText>
      )}
      <M.Collapse in={!!error}>
        <M.FormHelperText error>{error ? errors[error] || error : ' '}</M.FormHelperText>
      </M.Collapse>

      <M.List dense disablePadding>
        {value.map((policy) => (
          // XXX: sort?
          // XXX: navigate to policy on click?
          <M.ListItem key={policy.id} divider disableGutters>
            <M.ListItemText>
              {policy.title}
              <M.Box component="span" color="text.secondary">
                {' '}
                (
                {policy.managed ? (
                  <>{policy.permissions.length} buckets</>
                ) : (
                  <>unmanaged</>
                )}
                )
              </M.Box>
            </M.ListItemText>
            <M.ListItemSecondaryAction style={{ right: 0 }}>
              <M.Tooltip title="Detach this policy">
                <M.IconButton
                  onClick={() => detachPolicy(policy)}
                  edge="end"
                  size="small"
                >
                  <M.Icon fontSize="small">clear</M.Icon>
                </M.IconButton>
              </M.Tooltip>
            </M.ListItemSecondaryAction>
          </M.ListItem>
        ))}
        {!!availablePolicies?.length && (
          <M.ListItem button disableGutters onClick={openPolicySelection}>
            <M.ListItemText>
              {!value.length && <>No policies attached. </>}
              Attach policies&hellip;
            </M.ListItemText>
          </M.ListItem>
        )}
      </M.List>
      {availablePolicies && (
        <PolicySelectionDialog
          policies={availablePolicies}
          open={policySelectionOpen}
          onClose={closePolicySelection}
          attachPolicies={attachPolicies}
        />
      )}
    </div>
  )
}
