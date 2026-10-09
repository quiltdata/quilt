import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import useResizeObserver from 'use-resize-observer'

export interface Section {
  /** Matches the `data-section` attribute of the card it scrolls to. */
  key: string
  title: string
  status: string
  tone?: 'done' | 'bad'
}

// below this the rail would squeeze the fields under two columns; it becomes a tab strip
const NARROW = 640

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'start',
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: '180px minmax(0, 1fr)',
  },
  narrow: {
    gap: 0,
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
  rail: {
    background: t.palette.background.paper,
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  railNarrow: {
    borderBottom: `1px solid ${t.palette.divider}`,
    flexDirection: 'row',
    marginBottom: t.spacing(2),
    overflowX: 'auto',
  },
  item: {
    ...t.typography.body2,
    alignItems: 'center',
    background: 'none',
    border: 0,
    borderLeft: '3px solid transparent',
    color: t.palette.text.primary,
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(1),
    minHeight: 36,
    padding: t.spacing(0.5, 1.5),
    textAlign: 'left',
    '&:hover': { background: t.palette.action.hover },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
    '@media (pointer: coarse)': { minHeight: 44 },
  },
  itemNarrow: {
    borderBottom: '3px solid transparent',
    borderLeft: 0,
    flex: 'none',
    whiteSpace: 'nowrap',
  },
  active: {
    background: t.palette.action.selected,
    borderColor: t.palette.primary.main,
    fontWeight: t.typography.fontWeightMedium,
  },
  status: {
    color: t.palette.text.secondary,
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    marginLeft: 'auto',
  },
  // the .dark shades: main red/green are under 4.5:1 at this size
  bad: { color: t.palette.error.dark },
  done: { color: t.palette.success.dark },
  summary: {
    ...t.typography.body2,
    borderTop: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(1),
    padding: t.spacing(1.5, 1.5, 0),
  },
  summaryNarrow: {
    display: 'none',
  },
  bar: {
    borderRadius: 2,
    height: 4,
    marginTop: t.spacing(0.75),
  },
  content: {
    minWidth: 0,
  },
}))

interface SectionRailProps {
  sections: Section[]
  /** Required fields done, for the rail's progress line. */
  summary?: { done: number; total: number }
  children: React.ReactNode
}

/**
 * The guided form's section navigation (design A): a rail beside the cards, or a tab
 * strip above them when the pane is narrow. Sized by the pane, not the viewport.
 */
export default function SectionRail({ sections, summary, children }: SectionRailProps) {
  const classes = useStyles()
  const ref = React.useRef<HTMLDivElement>(null)
  const { width = 0 } = useResizeObserver({ ref })
  const narrow = width > 0 && width < NARROW
  const [active, setActive] = React.useState(sections[0]?.key)

  const find = (key: string) =>
    ref.current?.querySelector<HTMLElement>(`[data-section="${key}"]`) ?? null

  const go = (key: string) => {
    setActive(key)
    find(key)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  const keys = sections.map((s) => s.key).join('\n')
  React.useEffect(() => {
    // jsdom and old browsers: the rail still works, it just doesn't follow scrolling
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const key = (top?.target as HTMLElement | undefined)?.dataset.section
        if (key) setActive(key)
      },
      // a card counts as current while its top is in the upper part of the pane
      { rootMargin: '0px 0px -60% 0px' },
    )
    keys.split('\n').forEach((k) => {
      const el = find(k)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [keys])

  return (
    <div ref={ref} className={cx(classes.root, { [classes.narrow]: narrow })}>
      <nav
        aria-label="Metadata sections"
        className={cx(classes.rail, { [classes.railNarrow]: narrow })}
      >
        {sections.map((s) => (
          <button
            aria-current={active === s.key ? 'true' : undefined}
            className={cx(classes.item, {
              [classes.itemNarrow]: narrow,
              [classes.active]: active === s.key,
            })}
            key={s.key}
            onClick={() => go(s.key)}
            type="button"
          >
            <span>{s.title}</span>
            <span
              className={cx(classes.status, {
                [classes.bad]: s.tone === 'bad',
                [classes.done]: s.tone === 'done',
              })}
            >
              {s.tone === 'done' ? `✓ ${s.status}` : s.status}
            </span>
          </button>
        ))}
        {summary && !!summary.total && (
          <div className={cx(classes.summary, { [classes.summaryNarrow]: narrow })}>
            {summary.done} of {summary.total} required
            <M.LinearProgress
              aria-hidden
              className={classes.bar}
              value={(summary.done / summary.total) * 100}
              variant="determinate"
            />
          </div>
        )}
      </nav>
      <div className={classes.content}>{children}</div>
    </div>
  )
}
