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
import ObjectFilters from './ObjectFilters'
import PackageFilters from './PackageFilters'
import ResultsToolbar from './Results'
import ScrollToTop from './ScrollToTop'

function useMobileView() {
  const t = M.useTheme()
  return M.useMediaQuery(t.breakpoints.down('sm'))
}

const useSearchFieldStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

interface SearchFieldProps {
  className?: string
}

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField({ className }, inputRef) {
    const classes = useSearchFieldStyles()

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
    const clear = React.useCallback(() => {
      setQuery('')
      onChange('')
    }, [onChange])

    React.useEffect(
      () => setQuery(model.state.searchString || ''),
      [model.state.searchString],
    )

    return (
      <M.TextField
        autoFocus
        inputRef={inputRef}
        className={className}
        fullWidth
        onChange={handleChange}
        placeholder="Search"
        size="small"
        value={query}
        variant="outlined"
        InputProps={{
          classes,
          startAdornment: (
            <M.InputAdornment position="start">
              <M.Icon>search</M.Icon>
            </M.InputAdornment>
          ),
          endAdornment: query && (
            <M.InputAdornment position="end">
              <M.IconButton onClick={clear} edge="end">
                <M.Icon>close</M.Icon>
              </M.IconButton>
            </M.InputAdornment>
          ),
        }}
      />
    )
  },
)

const useMobileFiltersStyles = M.makeStyles((t) => ({
  filters: {
    padding: t.spacing(2),
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
    // TODO: Make scroll for sidebar
    // TODO: Also, consider that buckets filter disappears
    // overflow: 'hidden auto',
    // padding: t.spacing(0.5, 0, 0),
    // height: `calc(100vh - ${t.spacing(4 + 8)}px)` // -padding -header
  },
  bucket: {
    marginBottom: t.spacing(1),
  },
  variable: {
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
          <BucketSelector className={classes.bucket} />
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
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3, 0, 12), // space reserved for "Scroll to top"
  },
  withSidebar: {
    alignItems: 'start',
    display: 'grid',
    gridColumnGap: t.spacing(2),
    gridTemplateColumns: `${t.spacing(40)}px auto`,
  },
  search: {
    marginBottom: t.spacing(2),
  },
  results: {
    display: 'grid',
    gridAutoFlow: 'row',
    gridRowGap: t.spacing(2),
    gridTemplateColumns: '100%',
    overflow: 'hidden',

    // make space for box shadows
    padding: t.spacing(0.5),
    margin: t.spacing(-0.5),
  },
}))

interface MainProps {
  children: React.ReactNode
  inputRef: React.Ref<HTMLInputElement>
}

export default function Main({ inputRef, children }: MainProps) {
  const model = SearchUIModel.use()

  const classes = useStyles()

  const isMobile = useMobileView()
  const [showFilters, setShowFilters] = React.useState(false)
  const toggleFilters = React.useMemo(
    () =>
      isMobile || model.state.view === SearchUIModel.View.Table
        ? () => setShowFilters((x) => !x)
        : undefined,
    [isMobile, model.state.view],
  )

  return (
    <div className={classes.root}>
      <SearchField className={classes.search} ref={inputRef} />
      <div className={cx(!toggleFilters && classes.withSidebar)}>
        {toggleFilters ? (
          <MobileFilters open={showFilters} onClose={toggleFilters} />
        ) : (
          <Filters />
        )}
        <div className={classes.results}>
          <ResultsToolbar onFilters={toggleFilters} />
          {children}
        </div>
      </div>
      <ScrollToTop />
    </div>
  )
}
