import * as React from 'react'

/**
 * Width of the Qurator panel, and of the gutter Layout reserves for it. One
 * value: MUI's docked paper is `position: fixed` and reserves no space of its
 * own, so a second number here would show as a seam mid-slide.
 */
export const PANEL_WIDTH = 'min(40rem, 50vw)'

// Its own module so `Layout` can read the panel's state without importing the
// chat (and, through Sidebar, back into Layout).
export const Context = React.createContext(false)

/** Whether the panel is currently taking its width out of the main column. */
export const usePanelReflow = () => React.useContext(Context)
