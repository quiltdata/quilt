import * as React from 'react'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import type { MermaidProps } from './Mermaid'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

// mermaid is a large ESM-only bundle; keep it out of the main chunk.
const Mermaid: React.FC<MermaidProps> = RT.mkLazy(
  () => import('./Mermaid'),
  SuspensePlaceholder,
)

export default function MermaidWrapper(
  { contents }: { contents: string },
  props: React.HTMLAttributes<HTMLDivElement>,
) {
  return <Mermaid contents={contents} {...props} />
}
