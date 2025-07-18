import cx from 'classnames'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import { useBucketStrict } from 'containers/Bucket/Routes'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'

import SortSelector from '../Sort'
import * as SearchUIModel from '../model'

import ColumnTitle from './ColumnTitle'

interface CreatePackageProps {
  className: string
}

function CreatePackage({ className }: CreatePackageProps) {
  const bucket = useBucketStrict()
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

const I18_COUNT_RESULTS = {
  one: '1 result',
  other: (n: number) => (n > 0 ? `${n} results` : 'Results'),
}

const I18_COUNT_PACKAGES = {
  one: '1 package',
  other: (n: number) => (n > 0 ? `${n} packages` : 'Packages'),
}

function resultsCountI18n(n: number, state: SearchUIModel.SearchUrlState) {
  if (
    state.resultType === SearchUIModel.ResultType.QuiltPackage &&
    state.view === SearchUIModel.View.Table
  ) {
    return Format.pluralify(n, I18_COUNT_PACKAGES)
  }
  return Format.pluralify(n, I18_COUNT_RESULTS)
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
              {resultsCountI18n(r.data.total, model.state)}
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
    // XXX:
    // This is a color hardcoded for MUI.Button#outlined
    // https://github.com/mui/material-ui/blob/v4.x/packages/material-ui/src/Button/Button.js#L70
    // The same color for the latest Lab.ToggleButtonGroup, but we don't use it
    borderColor: `rgba(0, 0, 0, 0.23)`,
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
  onFilters?: () => void
}

export default function Results({ onFilters }: ResultsProps) {
  const model = SearchUIModel.use()
  const classes = useResultsStyles()
  return (
    <div className={classes.toolbar}>
      <ResultsCount />
      <div className={classes.controls}>
        {model.state.resultType === SearchUIModel.ResultType.QuiltPackage && (
          <ToggleResultsView className={classes.button} />
        )}
        {onFilters && <FiltersButton className={classes.button} onClick={onFilters} />}
        <SortSelector className={classes.button} />
      </div>
    </div>
  )
}
