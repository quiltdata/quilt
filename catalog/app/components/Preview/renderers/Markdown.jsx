import * as React from 'react'

import { Container } from 'components/Markdown'

export default ({ rendered }, props) => <Container {...props}>{rendered}</Container>
