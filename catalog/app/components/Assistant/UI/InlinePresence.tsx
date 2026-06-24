import DistributedContext from 'utils/DistributedContext'

// Tracks pages that embed their own inline Qurator chat.
const InlinePresence = DistributedContext<true>()

export const Provider = InlinePresence.Provider

// Wrap an inline chat in this to register its presence for as long as it's mounted.
export const Provide = InlinePresence.Provide

/**
 * Whether any page currently renders its own inline Qurator chat. While true, the
 * global Fab + sidebar suppress themselves so they don't duplicate it.
 */
export const useInlined = InlinePresence.makeCombinator((values) => values.length > 0)
