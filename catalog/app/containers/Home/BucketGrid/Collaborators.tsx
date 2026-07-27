import * as React from 'react'
import * as M from '@material-ui/core'

import { Popup } from 'components/Collaborators'
import type * as Model from 'model'

import usePotentialCollaborators from 'utils/usePotentialCollaborators'

// A card-local, quiet density of the shared collaborator vocabulary: icon +
// caption text, no dark pill / fill. The shared `Badge` (a loud overlay
// pill) stays untouched for the bucket header — this is a separate,
// card-appropriate rendering of the same data, not a variant of Badge.
const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: t.palette.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(0.5),
    padding: 0,
    '&:hover': {
      color: t.palette.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  // The empty ("only you") state is informational, not interactive, so it
  // never picks up the hover/focus treatment above.
  static: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    gap: t.spacing(0.5),
  },
  // Size the glyph from the readout's own type step rather than a literal off
  // the ramp; `fontSize="inherit"` on the Icon picks this up.
  icon: {
    fontSize: '1.2em',
  },
  label: {
    ...t.typography.caption,
  },
  // Tabular figures so counts line up down a column of cards.
  count: {
    ...t.typography.caption,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
  },
}))

interface CollaboratorsProps {
  bucket: string
  collaborators: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> | null
}

export default function Collaborators({ bucket, collaborators }: CollaboratorsProps) {
  const classes = useStyles()
  const potentialCollaborators = usePotentialCollaborators()
  const allCollaborators: Model.Collaborators = React.useMemo(
    () => [
      ...(collaborators || []),
      ...potentialCollaborators.map((collaborator) => ({
        collaborator,
        permissionLevel: undefined,
      })),
    ],
    [collaborators, potentialCollaborators],
  )

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  // Same derivation as the shared Badge: a known headcount, plus a `+` when
  // any collaborator has no assigned role (an unmanaged/implicit one).
  const knownNumber = allCollaborators.length
  const hasUnmanagedRole = React.useMemo(
    () => allCollaborators.find(({ permissionLevel }) => !permissionLevel),
    [allCollaborators],
  )

  if (!knownNumber) {
    return (
      <span className={classes.static}>
        <M.Icon className={classes.icon} fontSize="inherit">
          visibility_off
        </M.Icon>
        <span className={classes.label}>Only you</span>
      </span>
    )
  }

  return (
    <>
      <Popup
        bucket={bucket}
        collaborators={allCollaborators}
        onClose={handleClose}
        open={open}
      />
      <M.ButtonBase
        className={classes.root}
        onClick={handleOpen}
        aria-label="View collaborators"
      >
        <M.Icon className={classes.icon} fontSize="inherit">
          group
        </M.Icon>
        <span className={classes.label}>Shared with&nbsp;</span>
        <span className={classes.count}>
          {knownNumber}
          {hasUnmanagedRole ? '+' : ''}
        </span>
      </M.ButtonBase>
    </>
  )
}
