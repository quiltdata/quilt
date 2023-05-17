import * as React from 'react'
import * as RRDom from 'react-router-dom'

import DestinationBucket from 'components/Form/Package/DestinationBucket'

import RouteContainer from './RouteContainer'
import StateProvider, { useContext } from './StateProvider'

interface PackageEditorProps {
  bucket: string
  name: string
  hashOrTag: string
  hash?: string
  path: string
  mode?: string
  resolvedFrom?: string
  size?: number
}

function PackageEditor(props: PackageEditorProps) {
  const { state, actions } = useContext()
  React.useEffect(() => {
    actions.bucket.onPageLoad()
  }, [])
  return (
    <div>
      <DestinationBucket {...state.bucket} onChange={actions.bucket.onChange} />
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
          <PackageEditor {...resolvedProps} />
        </StateProvider>
      )}
    </RouteContainer>
  )
}
