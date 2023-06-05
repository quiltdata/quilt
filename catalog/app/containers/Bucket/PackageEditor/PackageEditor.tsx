import * as React from 'react'
import type * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as State from './State'
import FilesWorkspace from './FilesWorkspace'
import Header from './Header'
import Inputs from './Inputs'
import Metadata from './Metadata'
import RouteContainer from './RouteContainer'
import Success from './Success'

const useSectionStyles = M.makeStyles((t) => ({
  content: {
    flexGrow: 1,
    maxWidth: '100%',
  },
}))

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  const classes = useSectionStyles()
  return (
    <M.Accordion defaultExpanded>
      <M.AccordionSummary>
        <M.Typography variant="h5">{title}</M.Typography>
      </M.AccordionSummary>
      <M.AccordionDetails>
        <div className={classes.content}>{children}</div>
      </M.AccordionDetails>
    </M.Accordion>
  )
}

const useStyles = M.makeStyles({
  root: {
    position: 'relative',
  },
})

function PackageEditor() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <Header />
      <Section title="Info">
        <Inputs />
      </Section>
      <Section title="Files">
        <FilesWorkspace />
      </Section>
      <Section title="Metadata">
        <Metadata />
      </Section>
      <Success />
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
        <State.Provider {...resolvedProps}>
          <PackageEditor />
        </State.Provider>
      )}
    </RouteContainer>
  )
}
