import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import { CloseOnClick } from 'components/Buttons'
import { viewModeToSelectOption } from 'containers/Bucket/viewModes'
import type { ViewModes } from 'containers/Bucket/viewModes'
import * as NamedRoutes from 'utils/NamedRoutes'

import type { Features } from '../useFeatures'
import * as Context from './Context'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true } as const

// NOTE: 'div' is a workaround for hardcoded MUI types
interface MenuItemProps extends Omit<M.ListItemProps<'div'>, 'button'> {
  icon?: React.ReactElement
  children: React.ReactNode
}

function MenuItem({ icon, children, ...props }: MenuItemProps) {
  return (
    <M.ListItem {...props} button>
      {icon && <M.ListItemIcon>{icon}</M.ListItemIcon>}
      <M.ListItemText
        inset={!icon}
        primary={children}
        primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
      />
    </M.ListItem>
  )
}

interface LinkItemProps extends Omit<M.ListItemProps<typeof RRDom.Link>, 'button'> {
  icon?: React.ReactElement
  children: React.ReactNode
}

function LinkItem({ icon, children, ...props }: LinkItemProps) {
  return (
    <M.ListItem {...props} button component={RRDom.Link}>
      <M.ListItemIcon>{icon}</M.ListItemIcon>
      <M.ListItemText
        primary={children}
        primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
      />
    </M.ListItem>
  )
}

const useStyles = M.makeStyles((t) => ({
  danger: {
    color: t.palette.error.main,
  },
  subList: {
    '& + &': {
      borderTop: `1px solid ${t.palette.divider}`,
    },
  },
}))

interface OrganizeOptionsProps {
  viewModes?: ViewModes
  features: Exclude<Features['organize'], false>
}

export default function OrganizeOptions({ viewModes, features }: OrganizeOptionsProps) {
  const classes = useStyles()
  const {
    confirmDelete,
    editFile,
    editTypes,
    handle: { bucket, key, version },
    isBookmarked,
    toggleBookmark,
  } = Context.use()
  const { urls } = NamedRoutes.use()

  const viewModesOptions = React.useMemo(
    () => viewModes?.modes.map((m) => viewModeToSelectOption(m)) || [],
    [viewModes],
  )

  return (
    <CloseOnClick>
      <>
        <M.List dense className={classes.subList}>
          <MenuItem
            icon={
              isBookmarked ? <Icons.TurnedInOutlined /> : <Icons.TurnedInNotOutlined />
            }
            onClick={toggleBookmark}
          >
            {isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
          </MenuItem>
        </M.List>

        {editTypes.length && (
          <M.List dense className={classes.subList}>
            {editTypes.map((t) => (
              <MenuItem
                key={t.brace}
                icon={t.title ? <Icons.AssignmentOutlined /> : <Icons.SubjectOutlined />}
                onClick={() => editFile(t)}
              >
                {t.title || 'Edit text content'}
              </MenuItem>
            ))}
          </M.List>
        )}

        {viewModesOptions.length > 0 && (
          <M.List
            className={classes.subList}
            dense
            subheader={<M.ListSubheader inset>View as</M.ListSubheader>}
          >
            {viewModesOptions.map(({ toString, valueOf }) =>
              valueOf() === viewModes?.mode ? (
                <MenuItem key={toString()} icon={<Icons.CheckOutlined />} disabled>
                  {toString()}
                </MenuItem>
              ) : (
                <LinkItem
                  key={toString()}
                  to={urls.bucketFile(bucket, key, { version, mode: valueOf() })}
                >
                  {toString()}
                </LinkItem>
              ),
            )}
          </M.List>
        )}

        {features.delete && (
          <M.List dense className={classes.subList}>
            <MenuItem
              className={classes.danger}
              icon={<Icons.DeleteOutlined color="error" />}
              onClick={confirmDelete}
            >
              Delete
            </MenuItem>
          </M.List>
        )}
      </>
    </CloseOnClick>
  )
}
