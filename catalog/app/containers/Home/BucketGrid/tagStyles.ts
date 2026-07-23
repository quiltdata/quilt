import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

/**
 * One tag vocabulary across the whole Volumes screen.
 *
 * A tag is a filter, and it must look like the same object wherever it appears:
 * the "Shortcuts" row above the list, the tags inside a list row, and the tags
 * on a card are all the same token. Before this, the row/card tags were generic
 * round grey Material chips that turned `color="primary"` when matching, while
 * the Shortcuts row used square tertiary-tinted tokens — two shapes and two
 * active-state colors for one concept. This module is the single source of truth
 * so the three call sites can never drift apart again.
 *
 * Two deliberate shape decisions carried over from the original Shortcuts row:
 * (1) SQUARE corners (2px) set the tokens apart from the circular bucket discs
 * and any fully-round Material chip elsewhere — shape, not just color, does the
 * differentiating; (2) a SOFT tertiary tint at rest (wash fill + tinted text)
 * carries a little brand color without flooding the screen. The active token
 * fills solid with the tertiary accent so the current filter is unmistakable.
 */
export default M.makeStyles((t) => ({
  tag: {
    backgroundColor: fade(t.palette.tertiary.main, 0.08),
    border: `1px solid ${fade(t.palette.tertiary.main, 0.24)}`,
    borderRadius: 2,
    color: t.palette.tertiary.main,
    fontWeight: 500,
    '&:hover': {
      backgroundColor: fade(t.palette.tertiary.main, 0.16),
      borderColor: fade(t.palette.tertiary.main, 0.5),
    },
    '& .MuiChip-label': {
      paddingLeft: t.spacing(1.25),
      paddingRight: t.spacing(1.25),
    },
  },
  // Active token: filled tertiary, so the current filter is unmistakable. MUI's
  // clickable-chip hover darkens the background by default; pin it here so the
  // active token doesn't flash grey on hover.
  tagActive: {
    backgroundColor: t.palette.tertiary.main,
    borderColor: t.palette.tertiary.main,
    color: t.palette.common.white,
    '&:hover': {
      backgroundColor: t.palette.tertiary.dark,
      borderColor: t.palette.tertiary.dark,
    },
    '&:focus': {
      backgroundColor: t.palette.tertiary.main,
    },
  },
}))
