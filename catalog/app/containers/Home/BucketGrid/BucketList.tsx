import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'
import { assignGlyphs } from 'components/BucketIcon/seedGlyphs'
import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'

import type { Bucket } from './BucketGrid'
import Collaborators from './Collaborators'
import useTagStyles from './tagStyles'

const useStyles = M.makeStyles((t) => ({
  row: {
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  // The collaborator readout rides the right edge in an absolutely-positioned
  // secondary-action slot. Reserve a right gutter wide enough for the compact
  // "group glyph + N+" readout so neither the stacked title/address nor the
  // right-aligned tags ever slide under it. The slot sits at spacing(2) from
  // the edge; this reserves that plus the readout's own width. Applied only
  // when the readout is present.
  rowWithSecondary: {
    paddingRight: t.spacing(9),
  },
  avatar: {
    minWidth: t.spacing(6),
  },
  // Title and address stack: the title owns the first line as the scan anchor,
  // the address sits on its own line below. Stacking (not one inline row) is
  // what stops the two from competing for width and cutting each other off when
  // the row compacts.
  heading: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(0.25),
    maxWidth: '100%',
    minWidth: 0,
  },
  // The title is the scan anchor: a constant, bold left column down the list.
  // It gets the full row width and truncates last, so the human-readable name
  // is the thing that survives compaction.
  title: {
    color: t.palette.text.primary,
    fontWeight: 500,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '&:hover': {
      color: t.palette.tertiary.main,
    },
  },
  // The s3:// address is machine-exact identity, not prose: render it in the
  // mono face (the Mono Identity Rule) as a subordinate second line. The scheme
  // is dimmed and the bucket name held at full strength so the address reads as
  // "s3:// + <name>" — a clear segment from the title above, not a rival link.
  name: {
    ...t.typography.body2,
    alignSelf: 'flex-start',
    color: t.palette.text.hint,
    display: 'inline-flex',
    fontFamily: t.typography.monospace.fontFamily,
    maxWidth: '100%',
    minWidth: 0,
    '&:hover $nameId': {
      color: t.palette.tertiary.main,
    },
  },
  // dimmed, non-truncating scheme prefix — the constant part carries no info
  nameScheme: {
    color: t.palette.text.hint,
    flexShrink: 0,
    opacity: 0.65,
  },
  // the identifying part: full-strength, truncates with ellipsis if it must
  nameId: {
    color: t.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tags: {
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
    justifyContent: 'flex-end',
    marginLeft: t.spacing(2),
    maxWidth: '40%',
  },
}))

interface BucketRowProps {
  bucket: Bucket
  glyphIndex?: number
  divider: boolean
  onTagClick?: (tag: string) => void
  tagIsMatching: (tag: string) => boolean
  showCollaborators: boolean
}

function BucketRow({
  bucket,
  glyphIndex,
  divider,
  onTagClick,
  tagIsMatching,
  showCollaborators,
}: BucketRowProps) {
  const classes = useStyles()
  const tagClasses = useTagStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.bucketRoot(bucket.name)

  // Only reserve the right gutter when the readout actually occupies the
  // secondary-action slot; otherwise the row keeps its full width.
  const hasCollaborators = cfg.mode === 'PRODUCT' && showCollaborators

  return (
    <M.ListItem
      className={cx(classes.row, hasCollaborators && classes.rowWithSecondary)}
      divider={divider}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <M.ListItemAvatar className={classes.avatar}>
        <Link aria-hidden="true" tabIndex={-1} to={to}>
          <BucketIcon seed={bucket.name} glyphIndex={glyphIndex} src={bucket.iconUrl} />
        </Link>
      </M.ListItemAvatar>
      <M.ListItemText
        disableTypography
        primary={
          <span className={classes.heading}>
            <Link className={classes.title} to={to} title={bucket.title}>
              {bucket.title}
            </Link>
            <Link className={classes.name} to={to} title={`s3://${bucket.name}`}>
              <span className={classes.nameScheme}>s3://</span>
              <span className={classes.nameId}>{bucket.name}</span>
            </Link>
          </span>
        }
        secondary={
          bucket.description ? (
            <M.Typography variant="body2" color="textSecondary" noWrap component="span">
              {bucket.description}
            </M.Typography>
          ) : null
        }
      />
      {!!bucket.tags && !!bucket.tags.length && (
        <div className={classes.tags}>
          {bucket.tags.map((t) => (
            <M.Chip
              key={t}
              className={cx(tagClasses.tag, tagIsMatching(t) && tagClasses.tagActive)}
              label={t}
              size="small"
              clickable={!!onTagClick}
              onClick={onTagClick ? () => onTagClick(t) : undefined}
            />
          ))}
        </div>
      )}
      {hasCollaborators && (
        <M.ListItemSecondaryAction>
          <Collaborators
            bucket={bucket.name}
            collaborators={bucket.collaborators ?? null}
            variant="inline"
          />
        </M.ListItemSecondaryAction>
      )}
    </M.ListItem>
  )
}

interface BucketListProps {
  buckets: ReadonlyArray<Bucket>
  onTagClick?: (tag: string) => void
  tagIsMatching?: (tag: string) => boolean
  showAddLink?: boolean
  showCollaborators?: boolean
}

export default React.forwardRef<HTMLDivElement, BucketListProps>(function BucketList(
  {
    buckets,
    onTagClick,
    tagIsMatching = () => false,
    showAddLink = false,
    showCollaborators = true,
  },
  ref,
) {
  const { urls } = NamedRoutes.use()

  // Collision-free glyph assignment across the whole list so no two seeded
  // bucket icons repeat a glyph (recomputed only when the set of names changes).
  const glyphs = React.useMemo(() => assignGlyphs(buckets.map((b) => b.name)), [buckets])

  return (
    <M.Paper ref={ref}>
      <M.List disablePadding>
        {buckets.map((b, i) => (
          <BucketRow
            key={b.name}
            bucket={b}
            glyphIndex={glyphs.get(b.name)}
            divider={showAddLink || i < buckets.length - 1}
            onTagClick={onTagClick}
            tagIsMatching={tagIsMatching}
            showCollaborators={showCollaborators}
          />
        ))}
        {showAddLink && (
          <M.ListItem button component={Link} to={urls.adminBuckets({ add: true })}>
            <M.ListItemIcon>
              <M.Icon>add</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Add a bucket" />
          </M.ListItem>
        )}
      </M.List>
    </M.Paper>
  )
})
