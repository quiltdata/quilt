import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as FiltersUI from 'components/Filters'
import * as SearchUIModel from 'containers/Search/model'

// The search sidebar's "available filters" tree, lifted out of the search
// model. Structurally the same walk over a `FacetTree` -- the one change is
// that a leaf reports its selection to a callback instead of dispatching
// `activatePackagesMetaFilter` into the URL. See `PackageFilters.tsx` for the
// original.

const useStyles = M.makeStyles((t) => ({
  root: {
    background: 'inherit',
  },
  auxList: {
    background: 'inherit',
    listStyle: 'none',
    padding: 0,
  },
  nested: {
    paddingLeft: t.spacing(3),
  },
  iconWrapper: {
    minWidth: t.spacing(4),
  },
  icon: {
    transition: 'ease .15s transform',
  },
  expanded: {
    transform: 'rotate(90deg)',
  },
}))

function getLabel(key: string) {
  const [type, rest] = key.split(':')
  switch (type) {
    case 'path':
      return rest
    case 'type':
      return `Type: ${rest}`
    default:
      return key
  }
}

export type OnSelect = (path: string, tag: SearchUIModel.KnownPredicate['_tag']) => void

interface FacetGroupProps {
  disabled?: boolean
  path?: string
  items: SearchUIModel.FacetTree['children']
  onSelect: OnSelect
}

function FacetGroup({ disabled, path, items, onSelect }: FacetGroupProps) {
  const classes = useStyles()

  const [expanded, setExpanded] = React.useState(false)
  const toggleExpanded = React.useCallback(() => setExpanded((x) => !x), [])

  return (
    <li className={classes.root}>
      <ul className={classes.auxList}>
        {!!path && (
          <M.ListItem disabled={disabled} button disableGutters onClick={toggleExpanded}>
            <M.ListItemIcon className={classes.iconWrapper}>
              <M.Icon className={cx(classes.icon, { [classes.expanded]: expanded })}>
                chevron_right
              </M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary={getLabel(path)} />
          </M.ListItem>
        )}
        <div className={cx({ [classes.nested]: !!path })}>
          {/* The root group has no header to collapse, so it stays open. */}
          <M.Collapse in={expanded || !path}>
            {Array.from(items).map(([p, node]) =>
              node._tag === 'Tree' ? (
                <FacetGroup
                  disabled={disabled}
                  items={node.children}
                  key={path + p}
                  onSelect={onSelect}
                  path={p}
                />
              ) : (
                <FacetActivator
                  disabled={disabled}
                  facet={node.value}
                  key={path + p}
                  label={getLabel(p)}
                  onSelect={onSelect}
                />
              ),
            )}
          </M.Collapse>
        </div>
      </ul>
    </li>
  )
}

interface FacetActivatorProps {
  disabled?: boolean
  facet: SearchUIModel.PackageUserMetaFacet
  label: React.ReactNode
  onSelect: OnSelect
}

function FacetActivator({ disabled, facet, label, onSelect }: FacetActivatorProps) {
  const tag = SearchUIModel.PackageUserMetaFacetMap[facet.__typename]
  const handleClick = React.useCallback(
    () => onSelect(facet.path, tag),
    [onSelect, facet.path, tag],
  )
  return <FiltersUI.Activator title={label} onClick={handleClick} disabled={disabled} />
}

interface FacetPickerProps {
  className?: string
  disabled?: boolean
  facets: readonly SearchUIModel.PackageUserMetaFacet[]
  fetching: boolean
  onSelect: OnSelect
  truncated?: boolean
}

export default function FacetPicker({
  className,
  disabled,
  facets,
  fetching,
  onSelect,
  truncated,
}: FacetPickerProps) {
  const [tree] = React.useMemo(() => SearchUIModel.groupFacets(facets), [facets])

  if (fetching) {
    return (
      <div className={className}>
        <M.Typography variant="caption" color="textSecondary">
          Loading metadata fields&hellip;
        </M.Typography>
      </div>
    )
  }

  if (!facets.length) {
    return (
      <div className={className}>
        <M.Typography variant="caption" color="textSecondary">
          No package metadata fields found in the selected buckets.
        </M.Typography>
      </div>
    )
  }

  return (
    <div className={className}>
      <M.List dense disablePadding>
        <FacetGroup disabled={disabled} items={tree.children} onSelect={onSelect} />
      </M.List>
      {truncated && (
        <M.Typography variant="caption" color="textSecondary">
          Showing a sample of the available fields.
        </M.Typography>
      )}
    </div>
  )
}
