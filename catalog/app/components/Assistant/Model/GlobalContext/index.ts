import * as React from 'react'

import { useCurrentRoute } from '../navigation'

function useRouteContext() {
  const { match, loc } = useCurrentRoute()

  const description = React.useMemo(() => {
    if (!match) return ''
    const params = match.decoded?.params
      ? `
<parameters>
  ${JSON.stringify(match.decoded.params, null, 2)}
</parameters>
`
      : ''
    return `
<route-info>
  Name: "${match.descriptor.name}"
  <description>
    ${match.descriptor.description}
  </description>
  ${params}
</route-info>
`
  }, [match])

  const msg = React.useMemo(
    () =>
      `
<viewport>
  <current-location>
    ${JSON.stringify(loc, null, 2)}
  </current-location>
  ${description}
  Refer to "navigate" tool schema for navigable routes and their parameters.
</viewport>
`,
    [description, loc],
  )

  return msg
}

export function useGlobalContext() {
  return [useRouteContext()]
}

export { useGlobalContext as use }
