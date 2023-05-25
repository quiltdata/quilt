import * as React from 'react'
import type * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Inputs from './Inputs'
import FilesWorkspace from './FilesWorkspace'
import Metadata from './Metadata'
import RouteContainer from './RouteContainer'
import StateProvider from './State/Provider'

const useSectionStyles = M.makeStyles((t) => ({
  root: {
    '&:$expanded': {
      margin: '0 !important',
      minHeight: 'auto !important',
      paddingTop: t.spacing(1),
    },
  },
  expanded: {},
  content: {
    flexGrow: 1,
  },
}))

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  const classes = useSectionStyles()
  return (
    <M.Accordion defaultExpanded classes={classes}>
      <M.AccordionSummary>
        <M.Typography variant="h5">{title}</M.Typography>
      </M.AccordionSummary>
      <M.AccordionDetails>
        <div className={classes.content}>{children}</div>
      </M.AccordionDetails>
    </M.Accordion>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    marginTop: t.spacing(2),
  },
}))

function PackageEditor() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Section title="Info">
        <Inputs />
      </Section>
      <Section title="Files">
        <FilesWorkspace />
      </Section>
      <Section title="Metadata">
        <Metadata />
      </Section>
    </div>
  )
}

interface PackageTreeRouteParams {
  bucket: string
  name: string
  revision?: string
  path?: string
}

export default function PackageTreeWrapper(
  props: RRDom.RouteComponentProps<PackageTreeRouteParams>,
) {
  return (
    <RouteContainer {...props}>
      {(resolvedProps) => (
        <StateProvider {...resolvedProps}>
          <PackageEditor />
        </StateProvider>
      )}
    </RouteContainer>
  )
}
