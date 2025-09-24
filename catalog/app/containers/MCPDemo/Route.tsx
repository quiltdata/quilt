/**
 * MCP Demo Route
 *
 * This route provides a demo page for testing MCP functionality
 */

import * as React from 'react'
import * as M from '@material-ui/core'
import SearchIcon from '@material-ui/icons/Search'
import AddIcon from '@material-ui/icons/Add'
import EditIcon from '@material-ui/icons/Edit'
import BarChartIcon from '@material-ui/icons/BarChart'
import { MCPTestComponent, OAuthLoginButton } from 'components/Assistant/MCP'

export const MCPDemoRoute: React.FC = () => (
  <M.Container maxWidth="lg" style={{ paddingTop: 20, paddingBottom: 20 }}>
    <M.Typography variant="h3" gutterBottom>
      MCP (Model Context Protocol) Demo
    </M.Typography>

    <M.Typography variant="body1" paragraph>
      This page demonstrates the MCP Client functionality for Quilt data management. The
      MCP Client can connect to Docker-based MCP servers and execute tools for:
    </M.Typography>

    <M.List>
      <M.ListItem>
        <M.ListItemIcon>
          <SearchIcon />
        </M.ListItemIcon>
        <M.ListItemText primary="Searching Quilt packages" />
      </M.ListItem>
      <M.ListItem>
        <M.ListItemIcon>
          <AddIcon />
        </M.ListItemIcon>
        <M.ListItemText primary="Creating new packages" />
      </M.ListItem>
      <M.ListItem>
        <M.ListItemIcon>
          <EditIcon />
        </M.ListItemIcon>
        <M.ListItemText primary="Updating package metadata" />
      </M.ListItem>
      <M.ListItem>
        <M.ListItemIcon>
          <BarChartIcon />
        </M.ListItemIcon>
        <M.ListItemText primary="Creating visualizations" />
      </M.ListItem>
    </M.List>

    <M.Divider style={{ margin: '20px 0' }} />

    <M.Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
      <M.Typography variant="h5">Authentication</M.Typography>
      <OAuthLoginButton />
    </M.Box>

    <MCPTestComponent />
  </M.Container>
)

export default MCPDemoRoute
