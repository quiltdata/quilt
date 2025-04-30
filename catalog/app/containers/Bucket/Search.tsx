import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import { useDebouncedCallback } from 'use-debounce'

import {
  useMobileView,
  ObjectFilters,
  PackageFilters,
  ScrollToTop,
  Results,
} from 'containers/Search/Search'
import * as SearchUIModel from 'containers/Search/model'
import AssistantContext from 'containers/Search/AssistantContext'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import ResultTypeSelector from 'containers/Search/ResultType'
import BucketSelector from 'containers/Search/Buckets'

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
  return (
    <div className={cx(classes.root, className)}>
      {/* <ColumnTitle>Search for</ColumnTitle> */}
      <ResultTypeSelector />
      <BucketSelector disabled />
      {model.state.resultType === SearchUIModel.ResultType.QuiltPackage ? (
        <PackageFilters className={classes.variable} />
      ) : (
        <ObjectFilters className={classes.variable} />
      )}
      <ScrollToTop />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(2, 0),
    [t.breakpoints.up('md')]: {
      alignItems: 'start',
      display: 'grid',
      gridColumnGap: t.spacing(2),
      gridTemplateColumns: `${t.spacing(40)}px auto`,
      margin: t.spacing(3, 0),
    },
  },
  filtersMobile: {
    padding: t.spacing(2),
    minWidth: `min(${t.spacing(40)}px, 100vw)`,
  },
  filtersClose: {
    position: 'absolute',
    right: '2px',
    top: '10px',
  },
  sort: {
    marginLeft: t.spacing(2),
    flexShrink: 0,
  },
  search: {
    marginTop: t.spacing(3),
  },
}))

export function SearchLayout() {
  const model = SearchUIModel.use()
  const classes = useStyles()
  const isMobile = useMobileView()
  const [showFilters, setShowFilters] = React.useState(false)

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
    <>
      <MetaTitle>{model.state.searchString || 'Search'}</MetaTitle>
      <M.TextField
        className={classes.search}
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
      <div className={classes.root}>
        {isMobile ? (
          <M.Drawer
            anchor="left"
            open={showFilters}
            onClose={() => setShowFilters(false)}
          >
            <Filters className={classes.filtersMobile} />
            <M.IconButton
              className={classes.filtersClose}
              onClick={() => setShowFilters(false)}
            >
              <M.Icon>close</M.Icon>
            </M.IconButton>
          </M.Drawer>
        ) : (
          <Filters />
        )}
        <div>
          <Results onFilters={() => setShowFilters((x) => !x)} />
        </div>
      </div>
    </>
  )
}

export default function PackageListWrapper() {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  const { urls } = NamedRoutes.use()

  invariant(!!bucket, '`bucket` must be defined')

  const urlState: SearchUIModel.SearchUrlState = React.useMemo(
    () => ({
      resultType: SearchUIModel.ResultType.QuiltPackage,
      filter: SearchUIModel.PackagesSearchFilterIO.fromURLSearchParams(
        new URLSearchParams(),
      ),
      userMetaFilters: SearchUIModel.UserMetaFilters.fromURLSearchParams(
        new URLSearchParams(),
        SearchUIModel.META_PREFIX,
      ),
      searchString: '',
      buckets: [bucket],
      order: SearchUIModel.ResultOrder.NEWEST,
      latestOnly: true,
    }),
    [bucket],
  )
  return (
    <SearchUIModel.Provider urlState={urlState} base={urls.bucketPackageList(bucket)}>
      <AssistantContext />
      <SearchLayout />
    </SearchUIModel.Provider>
  )
}
