import * as React from 'react'
import * as M from '@material-ui/core'

import StyledLink from 'utils/StyledLink'

import * as SearchUIModel from './model'

/**
 * Split a package handle into its namespace and the rest.
 *
 * A handle is `namespace/name` with exactly one slash (quilt3's
 * PACKAGE_NAME_FORMAT, `^[\w-]+/[\w-]+$`), but a handle read off a search hit is
 * registry data, not a validated input: a slashless or empty value must render as
 * a plain name rather than a link to a namespace that cannot exist.
 */
export function splitHandle(handle: string): { namespace: string | null; name: string } {
  const slash = handle.indexOf('/')
  if (slash <= 0 || slash === handle.length - 1) return { namespace: null, name: handle }
  return { namespace: handle.slice(0, slash), name: handle.slice(slash + 1) }
}

/**
 * Build the URL that filters the current search down to one namespace, or null
 * where there is no search to narrow.
 *
 * The trailing slash is load-bearing: the `name` filter is a KeywordWildcard, and
 * the model appends `*`, so `proj/` matches the `proj/*` prefix and not the
 * namespace `projects`.
 *
 * Read via `useUnsafe`, so a package handle stays renderable outside a search —
 * a namespace link is an affordance on a list, not a precondition for naming a
 * package.
 */
export function useNamespaceUrl() {
  const model = SearchUIModel.useUnsafe()
  return React.useCallback(
    (namespace: string) => {
      if (!model || model.state.resultType !== SearchUIModel.ResultType.QuiltPackage) {
        return null
      }
      return model.makeUrl({
        ...model.state,
        // activate before set: setFilter asserts the key is already in `order`,
        // and the name filter is inactive until something turns it on.
        filter: SearchUIModel.PackagesSearchFilterIO.setFilter(
          SearchUIModel.PackagesSearchFilterIO.activateFilter(model.state.filter, 'name'),
          'name',
          SearchUIModel.Predicates.KeywordWildcard.fromString(`${namespace}/`),
        ),
      })
    },
    [model],
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    wordBreak: 'break-all',
  },
  // The namespace is a scanning aid, not the row's subject: it recedes so a
  // column of handles reads by package name first (Density Serves the Scientist).
  namespace: {
    color: t.palette.text.secondary,
  },
}))

interface PackageHandleProps {
  /** Full `namespace/name` handle, as stored. */
  handle: string
  /** Where the package itself goes. */
  to: string
  /** Wraps the package-name segment, e.g. a search-match highlight. */
  children?: (name: string) => React.ReactNode
}

/**
 * A package handle whose namespace segment filters the list to that namespace,
 * and whose name segment opens the package — the affordance
 * Bucket/PackageTree/PackageLink already gives the package header, on the list.
 */
export default function PackageHandle({ handle, to, children }: PackageHandleProps) {
  const classes = useStyles()
  const makeNamespaceUrl = useNamespaceUrl()
  const { namespace, name } = splitHandle(handle)
  const renderName = children ?? ((n: string) => n)
  const namespaceUrl = namespace && makeNamespaceUrl(namespace)
  return (
    <span className={classes.root}>
      {/* Plain text, not a link, where there is no search to narrow: a segment
          styled as interactive has to act on click. */}
      {namespace &&
        (namespaceUrl ? (
          <StyledLink
            className={classes.namespace}
            to={namespaceUrl}
            title={`Show only packages in ${namespace}/`}
          >
            {namespace}/
          </StyledLink>
        ) : (
          <span className={classes.namespace}>{namespace}/</span>
        ))}
      <StyledLink to={to}>{renderName(name)}</StyledLink>
    </span>
  )
}
