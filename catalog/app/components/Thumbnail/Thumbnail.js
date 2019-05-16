import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'

import * as AWS from 'utils/AWS'
import { useConfig } from 'utils/Config'
import { mkSearch } from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const SIZES = {
  sm: { w: 256, h: 256 },
  lg: { w: 1024, h: 768 },
}

const sizeStr = (s) => `w${SIZES[s].w}h${SIZES[s].h}`

export default RT.composeComponent(
  'Thumbnail',
  RC.setPropTypes({
    handle: PT.object.isRequired,
    size: PT.oneOf(['sm', 'lg']),
  }),
  RC.defaultProps({
    size: 'sm',
  }),
  ({ handle, size, alt = '', ...props }) => {
    const api = useConfig().apiGatewayEndpoint
    const sign = AWS.Signer.useS3Signer()
    const url = React.useMemo(() => sign(handle), [handle])
    const search = mkSearch({ url, size: sizeStr(size), output: 'raw' })
    const src = `${api}/thumbnail${search}`
    return <img src={src} alt={alt} {...props} />
  },
)
