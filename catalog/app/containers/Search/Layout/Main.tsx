import cx from 'classnames'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import { useDebouncedCallback } from 'use-debounce'

import BucketSelector from 'containers/Search/Buckets'
import ResultTypeSelector from 'containers/Search/ResultType'
import * as SearchUIModel from 'containers/Search/model'
import * as NamedRoutes from 'utils/NamedRoutes'

import ColumnTitle from './ColumnTitle'
import { useMobileView } from './Container'
import ObjectFilters from './ObjectFilters'
import PackageFilters from './PackageFilters'
import Results from './Results'
import ScrollToTop from './ScrollToTop'

interface SearchFieldProps {
  className?: string
}

function SearchField({ className }: SearchFieldProps) {
  const model = SearchUIModel.use()

  const [query, setQuery] = React.useState(model.state.searchString || '')
  const onChange = useDebouncedCallback(model.actions.setSearchString, 500)
  const handleChange = React.useCallback(
    (event) => {
      setQuery(event.target.value)
      onChange(event.target.value)
    },
    [onChange],
  )

  return (
    <M.TextField
      autoFocus
      className={className}
      fullWidth
      onChange={handleChange}
      placeholder="Search"
      size="small"
      value={query}
      variant="outlined"
      InputProps={{
        startAdornment: (
          <M.InputAdornment position="start">
            <M.Icon>search</M.Icon>
          </M.InputAdornment>
        ),
      }}
    />
  )
}

const useMobileFiltersStyles = M.makeStyles((t) => ({
  filters: {
    padding: t.spacing(8, 2, 2),
    minWidth: `min(${t.spacing(40)}px, 100vw)`,
  },
  close: {
    position: 'absolute',
    right: '2px',
    top: '10px',
  },
}))

interface MobileFiltersProps {
  open: boolean
  onClose: () => void
}

function MobileFilters({ open, onClose }: MobileFiltersProps) {
  const classes = useMobileFiltersStyles()
  return (
    <M.Drawer anchor="left" open={open} onClose={onClose}>
      <Filters className={classes.filters} />
      <M.IconButton className={classes.close} onClick={onClose}>
        <M.Icon>close</M.Icon>
      </M.IconButton>
    </M.Drawer>
  )
}

const useFiltersStyles = M.makeStyles((t) => ({
  root: {
    alignContent: 'start',
    display: 'grid',
    gridRowGap: t.spacing(2),
    gridTemplateRows: 'auto',
    paddingBottom: t.spacing(12), // space reserved for "Scroll to top"
    // TODO: Make scroll for sidebar
    // TODO: Also, consider that buckets filter disappears
    // overflow: 'hidden auto',
    // padding: t.spacing(0.5, 0, 0),
    // height: `calc(100vh - ${t.spacing(4 + 8)}px)` // -padding -header
  },
  variable: {
    marginTop: t.spacing(1),
    overflow: 'hidden auto',
  },
}))

interface FiltersProps {
  className?: string
}

function Filters({ className }: FiltersProps) {
  const classes = useFiltersStyles()
  const model = SearchUIModel.use()
  const { paths } = NamedRoutes.use()
  return (
    <div className={cx(classes.root, className)}>
      <RRDom.Switch>
        <RRDom.Route path={paths.search} exact>
          <ColumnTitle>Search for</ColumnTitle>
          <ResultTypeSelector />
          <BucketSelector disabled />
        </RRDom.Route>
      </RRDom.Switch>
      {
        {
          [SearchUIModel.ResultType.QuiltPackage]: (
            <PackageFilters className={classes.variable} />
          ),
          [SearchUIModel.ResultType.S3Object]: (
            <ObjectFilters className={classes.variable} />
          ),
        }[model.state.resultType]
      }
      <ScrollToTop />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  withSidebar: {
    alignItems: 'start',
    display: 'grid',
    gridColumnGap: t.spacing(2),
    gridTemplateColumns: `${t.spacing(40)}px auto`,
  },
  search: {
    marginBottom: t.spacing(2),
  },
}))

interface MainProps {
  className: string
  children: React.ReactNode
}

export default function Main({ className, children }: MainProps) {
  const model = SearchUIModel.use()

  const classes = useStyles()

  const isMobile = useMobileView()
  const [showFilters, setShowFilters] = React.useState(false)
  const toggleFilters = React.useCallback(() => setShowFilters((x) => !x), [])

  const sidebarHidden = isMobile || model.state.view === SearchUIModel.View.Table

  return (
    <div className={className}>
      <SearchField className={classes.search} />
      <div className={cx(!sidebarHidden && classes.withSidebar)}>
        {sidebarHidden ? (
          <MobileFilters open={showFilters} onClose={toggleFilters} />
        ) : (
          <Filters />
        )}
        <Results onFilters={toggleFilters}>{children}</Results>
      </div>
    </div>
  )
}
