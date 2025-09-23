import * as React from 'react'
import { Box, Container, Typography } from '@material-ui/core'

import Layout from 'components/Layout'

import AgentChat from './UI/AgentChat'

export default function AgentPage() {
  return (
    <Layout>
      <Container maxWidth="lg">
        <Box mt={4} mb={2}>
          <Typography variant="h4" component="h1" gutterBottom>
            Agent Assistant (MCP)
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Experimental MCP-powered assistant interface
          </Typography>
        </Box>
        <AgentChat />
      </Container>
    </Layout>
  )
}
