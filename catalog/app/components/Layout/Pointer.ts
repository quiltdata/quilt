import * as M from '@material-ui/core'

/**
 * A finger or stylus, which cannot be aimed as precisely as a mouse. The
 * instrument stays dense where the pointer is fine: a narrow column on a
 * desktop keeps its compact rows, and only touch pays for the bigger targets.
 */
export const COARSE = '@media (pointer: coarse)'

/** Comfortable touch target (WCAG 2.5.5 AAA, Material's own floor). */
export const TOUCH_TARGET = 44

export const useCoarse = () => M.useMediaQuery('(pointer: coarse)')
