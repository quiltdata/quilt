import DistributedContext from 'utils/DistributedContext'

// Tracks pages that embed their own inline Qurator chat. While any are mounted,
// the global Fab + sidebar suppress themselves so they don't duplicate it.
const InlinePresence = DistributedContext<true>()

export const Provider = InlinePresence.Provider

// Wrap an inline chat in this to register its presence for as long as it's mounted.
export const Provide = InlinePresence.Provide

// True while any inline chat is mounted.
export const useInlined = InlinePresence.makeCombinator((values) => values.length > 0)
