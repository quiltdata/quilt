import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'

import SortSelector from '../Sort'
import * as SearchUIModel from '../model'

import ColumnTitle from './ColumnTitle'
import { useMobileView } from './Container'

interface CreatePackageProps {
  className: string
}

function CreatePackage({ className }: CreatePackageProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleClick = React.useCallback(() => createDialog.open(), [createDialog])
  return (
    <>
      <M.Button
        className={className}
        color="primary"
        onClick={handleClick}
        size="small"
        startIcon={<M.Icon>add</M.Icon>}
        variant="contained"
      >
        Create new package
      </M.Button>
      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
    </>
  )
}

function resultsCountI18n(results: number) {
  return Format.pluralify(results, {
    one: '1 result',
    other: (n) => (n > 0 ? `${n} results` : 'Results'),
  })
}

function packagesCountI18n(results: number) {
  return Format.pluralify(results, {
    one: '1 package',
    other: (n) => (n > 0 ? `${n} packages` : 'Packages'),
  })
}

const useResultsCountStyles = M.makeStyles((t) => ({
  create: {
    marginLeft: t.spacing(2),
    [t.breakpoints.down('sm')]: {
      marginLeft: 'auto',
    },
  },
}))

function ResultsCount() {
  const classes = useResultsCountStyles()
  const model = SearchUIModel.use()
  const r = model.firstPageQuery
  const { paths } = NamedRoutes.use()
  switch (r._tag) {
    case 'fetching':
      return <Skeleton width={140} height={24} />
    case 'error':
      return null
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
          return null
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          return (
            <ColumnTitle>
              {model.state.resultType === SearchUIModel.ResultType.QuiltPackage &&
              model.state.view === SearchUIModel.View.Table
                ? packagesCountI18n(r.data.stats.total)
                : resultsCountI18n(r.data.stats.total)}
              <RRDom.Switch>
                <RRDom.Route path={paths.bucketRoot}>
                  <CreatePackage className={classes.create} />
                </RRDom.Route>
              </RRDom.Switch>
            </ColumnTitle>
          )
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}

const useFiltersButtonStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

interface FiltersButtonProps {
  className: string
  onClick: () => void
}

function FiltersButton({ className, onClick }: FiltersButtonProps) {
  const classes = useFiltersButtonStyles()
  return (
    <M.Button
      startIcon={<M.Icon fontSize="inherit">filter_list</M.Icon>}
      variant="outlined"
      className={cx(classes.root, className)}
      onClick={onClick}
    >
      Filters
    </M.Button>
  )
}

const useToggleButtonStyles = M.makeStyles({
  root: {
    // So, it occupies the same height as other buttons in that toolbar
    padding: '5px',
  },
})

interface ToggleResultsViewProps {
  className: string
}

function ToggleResultsView({ className }: ToggleResultsViewProps) {
  const classes = useToggleButtonStyles()
  const model = SearchUIModel.use()
  const handleChange = React.useCallback(
    (_e, value: SearchUIModel.View) => model.actions.setView(value),
    [model.actions],
  )
  return (
    <Lab.ToggleButtonGroup
      value={model.state.view}
      className={className}
      exclusive
      onChange={handleChange}
      size="small"
    >
      <Lab.ToggleButton value={SearchUIModel.View.Table} classes={classes}>
        <M.Icon>grid_on</M.Icon>
      </Lab.ToggleButton>
      <Lab.ToggleButton value={SearchUIModel.View.List} classes={classes}>
        <M.Icon>list</M.Icon>
      </Lab.ToggleButton>
    </Lab.ToggleButtonGroup>
  )
}

const useResultsStyles = M.makeStyles((t) => ({
  button: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  controls: {
    display: 'flex',
    marginLeft: 'auto',
  },
  toolbar: {
    alignItems: 'flex-end',
    display: 'flex',
    minHeight: '36px',
  },
}))

interface ResultsProps {
  onFilters: () => void
}

export default function Results({ onFilters }: ResultsProps) {
  const model = SearchUIModel.use()
  const classes = useResultsStyles()
  const isMobile = useMobileView()
  const sidebarHidden = isMobile || model.state.view === SearchUIModel.View.Table
  return (
    <div className={classes.toolbar}>
      <ResultsCount />
      <div className={classes.controls}>
        {model.state.resultType === SearchUIModel.ResultType.QuiltPackage && (
          <ToggleResultsView className={classes.button} />
        )}
        {sidebarHidden && (
          <FiltersButton className={classes.button} onClick={onFilters} />
        )}
        <SortSelector className={classes.button} />
      </div>
    </div>
  )
}
