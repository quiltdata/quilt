import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'

import SortSelector from '../Sort'
import * as SearchUIModel from '../model'

import ColumnTitle from './ColumnTitle'
import { useMobileView } from './Container'

interface CreatePackageProps {
  className: string
  bucket: string
}

function CreatePackage({ bucket, className }: CreatePackageProps) {
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
  const bucket = React.useMemo(
    () => (model.state.buckets.length === 1 ? model.state.buckets[0] : null),
    [model.state.buckets],
  )
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
              <Format.Plural
                value={r.data.stats.total}
                one="1 result"
                other={(n) => (n > 0 ? `${n} results` : 'Results')}
              />
              {bucket && <CreatePackage className={classes.create} bucket={bucket} />}
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

const useResultsStyles = M.makeStyles((t) => ({
  root: {
    // make space for box shadows
    margin: '-4px',
    overflow: 'hidden',
    padding: '4px',
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  controls: {
    display: 'flex',
    marginLeft: 'auto',
  },
  results: {
    marginTop: t.spacing(2),
  },
  toggleButton: {
    padding: '5px',
  },
  toolbar: {
    alignItems: 'flex-end',
    display: 'flex',
    minHeight: '36px',
  },
}))

interface ResultsProps {
  onFilters: () => void
  children: React.ReactNode
}

export default function Results({ children, onFilters }: ResultsProps) {
  const model = SearchUIModel.use()
  const classes = useResultsStyles()
  const isMobile = useMobileView()
  const { setView } = model.actions
  const sidebarHidden = isMobile || model.state.view === SearchUIModel.View.Table
  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <ResultsCount />
        <div className={classes.controls}>
          {model.state.resultType === SearchUIModel.ResultType.QuiltPackage && (
            <Lab.ToggleButtonGroup
              value={model.state.view}
              className={classes.button}
              exclusive
              onChange={(_e, value) => setView(value)}
              size="small"
            >
              <Lab.ToggleButton
                value={SearchUIModel.View.Table}
                className={classes.toggleButton}
              >
                <M.Icon>grid_on</M.Icon>
              </Lab.ToggleButton>
              <Lab.ToggleButton
                value={SearchUIModel.View.List}
                className={classes.toggleButton}
              >
                <M.Icon>list</M.Icon>
              </Lab.ToggleButton>
            </Lab.ToggleButtonGroup>
          )}
          {sidebarHidden && (
            <FiltersButton className={classes.button} onClick={onFilters} />
          )}
          <SortSelector className={classes.button} />
        </div>
      </div>
      {children}
    </div>
  )
}
