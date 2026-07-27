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
    // The header wash bleeds to the card's edges, so the regions carry their
    // own insets rather than the card carrying one padding for all of them.
    overflow: 'hidden',
    transition: t.transitions.create(['background-color', 'border-color'], {
      duration: 150,
    }),
    '&:hover': {
      backgroundColor: t.palette.action.hover,
      borderColor: t.palette.text.secondary,
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
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  // The content region: only rendered when there is content, so a sparse card
  // is header + footer with no hollow padded box between them.
  body: {
    padding: t.spacing(2),
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
  description: {
    ...(t.mixins as $TSFixMe).lineClamp(2),
    color: t.palette.text.secondary,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
  },
  tagsAfterDescription: {
    marginTop: t.spacing(1.5),
  },
  // ButtonBase (Chip's root when `clickable`) always stamps the global
  // `Mui-focusVisible` class alongside its own hashed one, so this is a
  // stable hook even though `.MuiChip-*` selectors are off-limits.
  tag: {
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  // A matching tag reads as "selected" via the Indicator Rule's amber, never
  // a solid fill: a wash + a matching border, layered on top of the chip's
  // own `color="default"` ground rather than replacing it with a fill.
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
  // The access readout gets a baseline of its own: a divider turns it from a
  // stray line trailing the content into a defined footer region.
  footer: {
    alignItems: 'center',
    borderTop: `1px solid ${t.palette.divider}`,
    display: 'flex',
    padding: t.spacing(1.5, 2),
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
      {(!!bucket.description || !!visibleTags.length) && (
        <div className={classes.body}>
          {!!bucket.description && (
            <M.Typography className={classes.description} component="p" variant="caption">
              {bucket.description}
            </M.Typography>
          )}
          {!!visibleTags.length && (
            <div
              className={cx(classes.tags, {
                [classes.tagsAfterDescription]: !!bucket.description,
              })}
            >
              {visibleTags.map((tg) => (
                <M.Chip
                  key={tg}
                  className={cx(classes.tag, { [classes.matching]: tagIsMatching(tg) })}
                  label={tg}
                  size="small"
                  clickable
                  color="default"
                  onClick={handleTagClick(tg)}
                />
              ))}
              {hiddenTagCount > 0 && (
                <span className={classes.moreTags}>+{hiddenTagCount} more</span>
              )}
            </div>
          )}
        </div>
      )}
      {cfg.mode === 'PRODUCT' && (
        <div className={classes.footer}>
          <Collaborators
            bucket={bucket.name}
            collaborators={bucket.collaborators ?? null}
          />
        </div>
      )}
    </div>
  )
}
