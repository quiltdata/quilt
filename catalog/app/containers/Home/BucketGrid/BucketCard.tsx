import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import BucketIcon from 'components/BucketIcon'
import cfg from 'constants/config'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'

import Collaborators from './Collaborators'

export interface Bucket {
  name: string
  title: string
  iconUrl: string | null
  description: string | null
  tags: ReadonlyArray<string> | null
  collaborators?: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> | null
}

// Enough tags to give a wall of cards texture without a chip runway; the
// rest collapse behind "+N more" rather than growing the card unpredictably.
const MAX_VISIBLE_TAGS = 4

// The avatar's "more presence" bump per the brief (32px list size -> 44px on
// the card); BucketIcon itself is untouched apart from the optional `size`.
const ICON_SIZE = 44

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    // Cards in a row equalize height. With no footer rule the slack simply
    // reads as body padding above the bottom row — the hollow look came from
    // bounding that slack with a second rule, not from the equal heights.
    height: '100%',
    // The header wash bleeds to the card's edges, so the regions carry their
    // own insets rather than the card carrying one padding for all of them.
    overflow: 'hidden',
    // Containing block for the header link's overlay (see `header::after`).
    position: 'relative',
    transition: t.transitions.create(['background-color', 'border-color'], {
      duration: 150,
    }),
    '&:hover': {
      backgroundColor: t.palette.action.hover,
      borderColor: t.palette.text.secondary,
    },
    // Pressed: the wash deepens one step. No transform and no shadow — the
    // Overlay-Only Rule reserves shadow for things that float and leave, and a
    // card that scales under the cursor is the consumer-SaaS gloss PRODUCT.md
    // names as an anti-reference. Tactility here is tonal, not spatial.
    '&:active': {
      backgroundColor: t.palette.action.selected,
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  // The identity block: the icon sits beside a two-line text column (title
  // over `s3://`) rather than beside the title alone, so the name aligns to
  // the title's left edge instead of hanging back at the card's padding edge.
  header: {
    alignItems: 'center',
    // A quiet midnight wash (not a solid band — the rail stays the one dark
    // mass) plus a rule, so identity reads as its own region of the card.
    backgroundColor: fade(t.palette.primary.main, 0.04),
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: t.spacing(1.5),
    minWidth: 0,
    padding: t.spacing(2),
    textDecoration: 'none',
    // Stretches this anchor over the whole card, so the card navigates. An
    // overlay rather than a wrapping link because the card contains a
    // `ButtonBase` and clickable chips, and a button inside an anchor breaks
    // keyboard and screen-reader behaviour.
    '&::after': {
      content: '""',
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      // Below the interactive children, which raise themselves above it.
      zIndex: 0,
    },
    // No `position` here: it would make the header the containing block for its
    // own `::after`, collapsing the card-wide click target to the header's bounds
    // while focused.
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  // The second and last band. It grows to fill the card, so its bottom row
  // (tags + access readout) settles at the foot without a dividing rule.
  body: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: t.spacing(1),
    padding: t.spacing(2),
  },
  // Not raised above the navigation overlay: raising the row lifts its
  // `space-between` gap too, and clicks in that whitespace stop navigating. Only
  // the controls themselves are raised (`tag`, `access`).
  bottomRow: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    justifyContent: 'space-between',
    // Absorbs the slack that row-height equalization leaves; `body`'s gap is
    // the floor when there is none.
    marginTop: 'auto',
  },
  // The icon is a fixed-size disc: without this it inherits `flex-shrink: 1`
  // and a long title squashes the circle into an ellipse.
  icon: {
    flexShrink: 0,
  },
  identity: {
    minWidth: 0,
  },
  // body1 (1rem) at medium weight rather than the 1.25rem Title step: on a
  // ~390px card the larger step truncated real bucket names, and DESIGN.md
  // already sanctions 1rem body1 as a documented size.
  title: {
    color: t.palette.text.primary,
    fontWeight: t.typography.fontWeightMedium,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  name: {
    color: t.palette.text.secondary,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Raised above the navigation overlay so the blurb stays selectable: as
  // non-positioned content it painted under the overlay, and a drag to select it
  // navigated instead. Costs the click-to-navigate area over these two lines.
  description: {
    ...(t.mixins as $TSFixMe).lineClamp(2),
    color: t.palette.text.secondary,
    position: 'relative',
    zIndex: 1,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
  },
  // ButtonBase (Chip's root when `clickable`) always stamps the global
  // `Mui-focusVisible` class alongside its own hashed one, so this is a
  // stable hook even though `.MuiChip-*` selectors are off-limits.
  // Raised per-chip, not on the `tags` wrapper, so the wrapper's flex gaps stay
  // under the navigation overlay.
  tag: {
    position: 'relative',
    zIndex: 1,
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  // A matching tag reads as "selected" via the Indicator Rule's amber, never a
  // solid fill: an amber wash and border on the outlined chip. Both states
  // carry a border, so selecting a tag does not resize it.
  matching: {
    backgroundColor: fade(t.palette.secondary.main, 0.15),
    border: `1px solid ${t.palette.secondary.main}`,
    color: t.palette.text.primary,
  },
  moreTags: {
    ...t.typography.caption,
    alignSelf: 'center',
    color: t.palette.text.secondary,
  },
  // Raised for the same reason as `tag`: the readout opens the collaborator
  // dialog. This wrapper hugs its button (`flexShrink: 0`, no padding), so
  // raising it does not lift any whitespace with it.
  access: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    position: 'relative',
    zIndex: 1,
  },
}))

interface BucketCardProps {
  bucket: Bucket
  tagIsMatching: (tag: string) => boolean
  onTagClick: (tag: string) => void
}

export default function BucketCard({
  bucket,
  tagIsMatching,
  onTagClick,
}: BucketCardProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.bucketRoot(bucket.name)

  const tags = bucket.tags || []
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS)
  const hiddenTagCount = tags.length - visibleTags.length

  const handleTagClick = React.useCallback(
    (tg: string) => (e: React.SyntheticEvent) => {
      // Tags are independent chips beside (not inside) the header link, so
      // this isn't guarding against a nested anchor — it's making sure a tag
      // click reads as "filter by this tag" only, never a card navigation.
      e.preventDefault()
      e.stopPropagation()
      onTagClick(tg)
    },
    [onTagClick],
  )

  return (
    <div
      className={classes.root}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <Link className={classes.header} to={to} title={bucket.title}>
        <BucketIcon
          className={classes.icon}
          src={bucket.iconUrl}
          label={bucket.title}
          tintKey={bucket.name}
          size={ICON_SIZE}
        />
        <div className={classes.identity}>
          <M.Typography className={classes.title} component="span" variant="body1">
            {bucket.title}
          </M.Typography>
          <M.Typography className={classes.name} component="span" variant="body2">
            s3://{bucket.name}
          </M.Typography>
        </div>
      </Link>
      <div className={classes.body}>
        {!!bucket.description && (
          <M.Typography className={classes.description} component="p" variant="body2">
            {bucket.description}
          </M.Typography>
        )}
        <div className={classes.bottomRow}>
          <div className={classes.tags}>
            {visibleTags.map((tg) => (
              <M.Chip
                key={tg}
                className={cx(classes.tag, { [classes.matching]: tagIsMatching(tg) })}
                label={tg}
                size="small"
                variant="outlined"
                clickable
                color="default"
                onClick={handleTagClick(tg)}
              />
            ))}
            {hiddenTagCount > 0 && (
              <span className={classes.moreTags}>+{hiddenTagCount} more</span>
            )}
          </div>
          {cfg.mode === 'PRODUCT' && (
            <div className={classes.access}>
              <Collaborators
                bucket={bucket.name}
                collaborators={bucket.collaborators ?? null}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
