import * as React from 'react'
import * as M from '@material-ui/core'

import { Popup } from 'components/Collaborators'
import type * as Model from 'model'

import usePotentialCollaborators from 'utils/usePotentialCollaborators'

const useStyles = M.makeStyles((t) => ({
  // A quiet, labelled access readout: the people glyph, a tabular count, and —
  // in the footer variant — plain-language framing. One visual language, two
  // densities. 'footer' seats the full "Shared with N" sentence on the card's
  // footer baseline; 'inline' drops the label to a compact glyph+count that
  // rides the right edge of a dense list row without crowding the tags.
  root: {
    ...t.typography.body2,
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: t.palette.text.secondary,
    cursor: 'pointer',
    display: 'inline-flex',
    font: 'inherit',
    gap: t.spacing(0.75),
    padding: 0,
    '&:hover $count': {
      color: t.palette.tertiary.main,
    },
  },
  // Size the glyph from the readout's own type step (body2) rather than a
  // literal off the ramp; fontSize="inherit" on the Icon picks this up.
  icon: {
    color: t.palette.text.hint,
    fontSize: '1.2em',
  },
  count: {
    color: t.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 500,
    transition: 'color 120ms ease',
  },
  // In the compact row readout the label is redundant with the column context,
  // so it collapses visually — the glyph carries the meaning, the tooltip spells
  // it out. Kept in the DOM (not removed) so screen readers still read the full
  // "Shared with N".
  labelHidden: {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: 1,
    margin: -1,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 1,
  },
  private: {
    ...t.typography.body2,
    alignItems: 'center',
    color: t.palette.text.hint,
    display: 'inline-flex',
    gap: t.spacing(0.75),
  },
}))

interface CollaboratorsProps {
  bucket: string
  collaborators: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> | null
  // 'footer' (default) is the card's baseline readout with the full label;
  // 'inline' is the dense-row readout with a visually-hidden label.
  variant?: 'footer' | 'inline'
}

export default function Collaborators({
  bucket,
  collaborators,
  variant = 'footer',
}: CollaboratorsProps) {
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

  const knownNumber = allCollaborators.length
  // A collaborator with no managed permission level is inferred, not confirmed:
  // surface that as "N+" the way the old badge did.
  const hasUnmanagedRole = React.useMemo(
    () => allCollaborators.some(({ permissionLevel }) => !permissionLevel),
    [allCollaborators],
  )

  if (!knownNumber) {
    return (
      <M.Tooltip title="Only you have access">
        <span className={classes.private}>
          <M.Icon className={classes.icon} fontSize="inherit">
            visibility_off
          </M.Icon>
          <span className={variant === 'inline' ? classes.labelHidden : undefined}>
            Only you
          </span>
        </span>
      </M.Tooltip>
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
      <M.Tooltip title="View collaborators">
        <button type="button" className={classes.root} onClick={handleOpen}>
          <M.Icon className={classes.icon} fontSize="inherit">
            group
          </M.Icon>
          <span className={variant === 'inline' ? classes.labelHidden : undefined}>
            Shared with&nbsp;
          </span>
          <span className={classes.count}>
            {knownNumber}
            {hasUnmanagedRole ? '+' : ''}
          </span>
        </button>
      </M.Tooltip>
    </>
  )
}
