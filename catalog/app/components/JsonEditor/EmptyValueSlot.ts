import * as React from 'react'

import type { RenderEmptyValue } from './constants'

/** The cell slot of AI-SUGGESTIONS-CONTRACT.md §0, read by empty value previews. */
export const EmptyValueSlot = React.createContext<RenderEmptyValue | null>(null)
