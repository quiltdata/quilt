import * as React from 'react'

import { Container } from 'components/Markdown'

export default ({ rendered }: { rendered: string }, props?: { className?: string }) => (
  <Container {...props}>{rendered}</Container>
)
