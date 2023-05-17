import * as React from 'react'
import * as RRDom from 'react-router-dom'

import DestinationBucket from 'components/Form/Package/DestinationBucket'

import RouteContainer from './RouteContainer'
import StateProvider, { useContext } from './StateProvider'

function PackageEditor() {
  const { bucket } = useContext()
  return (
    <div>
      <DestinationBucket {...bucket.state} onChange={bucket.actions.onChange} />
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
