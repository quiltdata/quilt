import * as React from 'react'

/**
 * Width of the expanded Qurator panel, and of the gutter Layout reserves for
 * it. One value: MUI's docked paper is `position: fixed` and reserves no space
 * of its own, so a second number here would show as a seam mid-slide.
 */
export const PANEL_WIDTH = 'min(40rem, 50vw)'

/** Matches the left rail's `COLLAPSED` (`t.spacing(9)`). */
export const RAIL_WIDTH = '72px'

// Shared by the paper's width and Layout's gutter: gating only one would slide
// the paper over content that snapped.
export const MOTION = '@media (prefers-reduced-motion: no-preference)'

// Its own module so `Layout` can read the panel's width without importing the
// chat (and, through Sidebar, back into Layout).
export const Context = React.createContext<string | null>(null)

/** Gutter the panel is currently taking out of the main column, if any. */
export const usePanelGutter = () => React.useContext(Context)
