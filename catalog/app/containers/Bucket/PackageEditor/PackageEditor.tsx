import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Inputs from './Inputs'
import RouteContainer from './RouteContainer'
import StateProvider from './StateProvider'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    marginTop: t.spacing(2),
  },
  main: {
    marginTop: t.spacing(2),
    flexGrow: 1,
  },
  sectionHeader: {
    margin: '0 !important',
    minHeight: 'auto !important',
    paddingTop: t.spacing(1),
  },
}))

function PackageEditor() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <M.Accordion defaultExpanded>
        <M.AccordionSummary classes={{ expanded: classes.sectionHeader }}>
          <M.Typography variant="h5">Main</M.Typography>
        </M.AccordionSummary>
        <M.AccordionDetails>
          <div className={classes.main}>
            <Inputs />
          </div>
        </M.AccordionDetails>
      </M.Accordion>
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
