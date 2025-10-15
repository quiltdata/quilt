interface Comparison {
  head?: string
  changes: [string, string]
  tail?: string
}

export default function comparePaths(base: string, other: string): Comparison | null {
  if (base === other) return null

  const baseArr = [...base]
  const otherArr = [...other]
  const headIndex = baseArr.findIndex((char, i) => char !== otherArr[i])

  if (headIndex < 0) {
    // `base` is a prefix of `other`
    return {
      head: base || undefined,
      changes: ['', other.slice(base.length)],
      tail: undefined,
    }
  }

  const baseReversed = baseArr.reverse()
  const otherReversed = otherArr.reverse()
  const tailIndex = baseReversed.findIndex((char, i) => char !== otherReversed[i])

  if (tailIndex < 0) {
    throw new Error('Strings are identical from the tail but different from head')
  }

  let unchangedHead = headIndex > 0 ? base.slice(0, headIndex) : undefined

  let changedBase = base.slice(headIndex, base.length - tailIndex)
  let changedOther = other.slice(headIndex, other.length - tailIndex)

  let unchangedTail = tailIndex > 0 ? base.slice(base.length - tailIndex) : undefined

  return {
    head: unchangedHead,
    changes: [changedBase, changedOther],
    tail: unchangedTail,
  }
}
