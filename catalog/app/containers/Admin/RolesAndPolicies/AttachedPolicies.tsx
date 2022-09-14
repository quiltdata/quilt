import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'
import useQuery from 'utils/useQuery'

import { MAX_POLICIES_PER_ROLE } from './shared'

import POLICIES_QUERY from './gql/Policies.generated'
import { PolicySelectionFragment as Policy } from './gql/PolicySelection.generated'

interface PolicySelectionDialogProps {
  open: boolean
  onClose: () => void
  policies: Policy[]
  attachPolicy: (policy: Policy) => void
}

function PolicySelectionDialog({
  open,
  onClose,
  policies,
  attachPolicy,
}: PolicySelectionDialogProps) {
  const [selected, setSelected] = React.useState<Policy | null>(null)

  const handleExited = React.useCallback(() => {
    if (selected) attachPolicy(selected)
    setSelected(null)
  }, [attachPolicy, selected, setSelected])

  const select = React.useCallback(
    (policy: Policy) => {
      setSelected(policy)
      onClose()
    },
    [setSelected, onClose],
  )

  return (
    <M.Dialog maxWidth="xs" open={open} onClose={onClose} onExited={handleExited}>
      <M.DialogTitle>Attach a policy</M.DialogTitle>
      <M.List dense>
        {policies.length ? (
          policies.map((policy) => (
            <M.ListItem button key={policy.id} onClick={() => select(policy)}>
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
            </M.ListItem>
          ))
        ) : (
          <M.DialogContent dividers>
            <M.Typography>No more policies to attach</M.Typography>
          </M.DialogContent>
        )}
      </M.List>
      <M.DialogActions>
        <M.Button autoFocus onClick={onClose} color="primary">
          Cancel
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

interface AttachedPoliciesProps extends RF.FieldRenderProps<Policy[]> {
  className?: string
  onAdvanced?: () => void
}

export default function AttachedPolicies({
  className,
  input: { value, onChange },
  meta,
  onAdvanced,
}: AttachedPoliciesProps) {
  const error =
    meta.submitFailed && (meta.error || (!meta.dirtySinceLastSubmit && meta.submitError))

  const policiesData = useQuery({ query: POLICIES_QUERY })

  const [policySelectionOpen, setPolicySelectionOpen] = React.useState(false)

  const openPolicySelection = React.useCallback(() => {
    setPolicySelectionOpen(true)
  }, [setPolicySelectionOpen])

  const closePolicySelection = React.useCallback(() => {
    setPolicySelectionOpen(false)
  }, [setPolicySelectionOpen])

  const attachPolicy = React.useCallback(
    (policy: Policy) => {
      onChange(value.concat(policy))
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

  const maxReached = value.length >= MAX_POLICIES_PER_ROLE

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
      <M.FormHelperText>
        Manage access by combining <strong>up to {MAX_POLICIES_PER_ROLE}</strong> reusable
        policies
        {!!onAdvanced && (
          <>
            {' '}
            or <StyledLink onClick={onAdvanced}>set existing role via ARN</StyledLink>
          </>
        )}
      </M.FormHelperText>
      <M.Collapse in={!!error}>
        <M.FormHelperText error>{error || ' '}</M.FormHelperText>
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
        {!maxReached && !!availablePolicies?.length && (
          <M.ListItem button disableGutters onClick={openPolicySelection}>
            <M.ListItemText>
              {!value.length && <>No policies attached. </>}
              Attach a policy&hellip;
            </M.ListItemText>
          </M.ListItem>
        )}
      </M.List>
      {availablePolicies && (
        <PolicySelectionDialog
          policies={availablePolicies}
          open={policySelectionOpen}
          onClose={closePolicySelection}
          attachPolicy={attachPolicy}
        />
      )}
    </div>
  )
}
