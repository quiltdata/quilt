import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as FiltersUI from 'components/Filters'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'

import { useNamespaceUrl } from '../NamespaceLink'
import * as SearchUIModel from '../model'

interface Namespace {
  readonly namespace: string
  readonly count: number
}

interface Namespaces {
  readonly items: readonly Namespace[]
  readonly truncated: boolean
}

function useNamespaces(): { fetching: boolean; namespaces: Namespaces | undefined } {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  return GQL.fold(model.baseSearchQuery, {
    data: ({ searchPackages: r }) => {
      switch (r.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
        case 'OperationError':
          return { fetching: false, namespaces: undefined }
        case 'PackagesSearchResultSet':
          return {
            fetching: false,
            namespaces: {
              items: r.stats.namespaces,
              truncated: r.stats.namespacesTruncated,
            },
          }
        default:
          assertNever(r)
      }
    },
    fetching: () => ({ fetching: true, namespaces: undefined }),
    error: () => ({ fetching: false, namespaces: undefined }),
  })
}

/** The namespace the list is currently narrowed to, or null. */
function useActiveNamespace(): string | null {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const name = model.state.filter.predicates.name
  if (!name?.wildcard) return null
  // Only a bare `<ns>/` is this facet's own doing; a hand-written wildcard
  // (`proj/*a*`) is the user's filter and must not read as a selected namespace.
  const m = /^([^/*?]+)\/$/.exec(name.wildcard)
  return m ? m[1] : null
}

const useStyles = M.makeStyles((t) => ({
  scrollArea: {
    border: `1px solid ${M.fade(t.palette.text.primary, 0.23)}`,
    borderRadius: t.shape.borderRadius,
    maxHeight: t.spacing(30),
    overflow: 'hidden auto',
  },
  item: {
    display: 'flex',
    gap: t.spacing(1),
    justifyContent: 'space-between',
    padding: t.spacing(0.5, 1),
  },
  selected: {
    background: M.fade(t.palette.primary.main, 0.08),
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Exact counts, tabular so a column of them lines up (Trust Is Rendered).
  count: {
    color: t.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  help: {
    display: 'block',
    marginTop: t.spacing(1),
  },
}))

/**
 * Namespaces among the matching packages, each a link that narrows the list to
 * it. Single-select, not checkboxes: a package has exactly one namespace, so
 * two of them at once would always match nothing.
 */
export default function NamespaceFacet() {
  const classes = useStyles()
  const { fetching, namespaces } = useNamespaces()
  const active = useActiveNamespace()
  const makeNamespaceUrl = useNamespaceUrl()
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const { deactivatePackagesFilter } = model.actions

  const clear = React.useCallback(
    () => deactivatePackagesFilter('name'),
    [deactivatePackagesFilter],
  )

  // Nothing to choose between: one namespace is the whole list.
  if (!fetching && (namespaces?.items.length ?? 0) < 2 && !active) return null

  return (
    <FiltersUI.Container
      defaultExpanded
      title="Namespace"
      onDeactivate={active ? clear : undefined}
    >
      {!fetching && !!namespaces && (
        <>
          <div className={classes.scrollArea}>
            <M.List dense disablePadding>
              {namespaces.items.map(({ namespace, count }) => {
                const to = makeNamespaceUrl(namespace)
                const selected = namespace === active
                return (
                  <M.ListItem
                    key={namespace}
                    className={cx(classes.item, selected && classes.selected)}
                    disableGutters
                  >
                    <span className={classes.name} title={`${namespace}/`}>
                      {selected || !to ? (
                        `${namespace}/`
                      ) : (
                        <StyledLink to={to}>{namespace}/</StyledLink>
                      )}
                    </span>
                    <span className={classes.count}>{count}</span>
                  </M.ListItem>
                )
              })}
            </M.List>
          </div>
          {namespaces.truncated && (
            <M.Typography variant="caption" className={classes.help}>
              Only the largest {namespaces.items.length} namespaces are shown.
            </M.Typography>
          )}
        </>
      )}
    </FiltersUI.Container>
  )
}
