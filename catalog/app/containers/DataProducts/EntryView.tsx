import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import Markdown from 'components/Markdown'
import Perspective from 'components/Preview/renderers/Perspective'
import * as DP from 'model/DataProducts'
import { readableBytes } from 'utils/string'

/**
 * One file inside a data product: its identity, and a preview when one is honest.
 *
 * The constraint that shapes this file: **the UI is not in the byte path.** It
 * hands a locator plus the user's credential to a broker and gets bytes back, so
 * it has no S3 handle, no AWS client, and no signer. Every loader in
 * `components/Preview/loaders` requires a handle, which is why this does not use
 * them.
 *
 * What it uses instead are the *renderers*, which turn out to be reachable
 * without S3 -- verified by reading them rather than assumed:
 * - `components/Markdown` imports no AWS anything and takes `data: string`.
 * - `JsonDisplay` takes `value: unknown`; its only coupling is that `s3://`
 *   strings become bucket links, suppressed with `noS3Links`.
 * - `Perspective` (tabular) has no `handle` prop at all and accepts a raw CSV
 *   string. `containers/Queries/Athena/Results.tsx` already drives it from
 *   in-memory rows with no handle, which is the precedent this follows.
 *
 * Note what is deliberately *not* here: an image, PDF, or Parquet preview. Those
 * renderers need a URL the browser can fetch or a Blob, and a broker that returns
 * text cannot supply either. So those files render as identity-without-preview.
 * That is the honest outcome; the alternative is a pane that looks like a preview
 * and is not.
 */

const useStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
  },
  head: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: t.spacing(1.5, 2),
  },
  name: {
    ...t.typography.body2,
    // A single file path read as identity, not a repeated scanning label
    // (Mono Identity Rule).
    fontFamily: t.typography.monospace.fontFamily,
    overflowWrap: 'anywhere',
  },
  facts: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    marginTop: t.spacing(0.5),
  },
  usl: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    display: 'block',
    fontFamily: t.typography.monospace.fontFamily,
    marginTop: t.spacing(1),
    // Wrapped rather than truncated: a pinned URI is exact data, and exact values
    // are not shortened without a copy escape hatch.
    overflowWrap: 'anywhere',
  },
  body: {
    padding: t.spacing(2),
  },
  plain: {
    ...t.typography.body2,
    fontFamily: t.typography.monospace.fontFamily,
    margin: 0,
    // `pre-wrap` rather than `pre`: a data file's lines can be long, and a
    // horizontal scrollbar hides content behind an interaction.
    whiteSpace: 'pre-wrap',
  },
  note: {
    marginBottom: t.spacing(1),
  },
}))

const extensionOf = (logicalKey: string) => {
  const base = logicalKey.slice(logicalKey.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase()
}

/**
 * Which renderer suits a file, by extension.
 *
 * Extension rather than sniffing, matching what the app's own preview registry
 * does (`components/Preview/load.jsx` resolves loaders by `detect(key)`), so a
 * data product classifies files the same way the bucket browser does.
 *
 * Exported for tests: the mapping is the interesting part, and asserting it
 * directly beats asserting it through three layers of rendering.
 */
export type PreviewKind = 'markdown' | 'json' | 'tabular' | 'text' | 'none'

export function previewKindFor(logicalKey: string): PreviewKind {
  switch (extensionOf(logicalKey)) {
    case 'md':
    case 'rmd':
      return 'markdown'
    case 'json':
      return 'json'
    case 'csv':
    case 'tsv':
    case 'tab':
      return 'tabular'
    case 'txt':
    case 'log':
    case 'yaml':
    case 'yml':
    case 'sh':
    case 'py':
    case 'sql':
    case 'r':
      return 'text'
    default:
      // Everything else -- images, PDFs, Parquet, TIFFs -- has no text rendering.
      // Not a gap to fill later with a guess: those need bytes this path cannot
      // carry.
      return 'none'
  }
}

/**
 * Delimited text, through the real tabular renderer.
 *
 * **This replaced a hand-rolled `split(delimiter)` parser, which was wrong in a
 * way that mattered.** A table asserts record boundaries, headers and column
 * counts with visual authority, so a parser that mis-splits does not merely look
 * rough -- it states something false about scientific data. The inputs it got
 * wrong were ordinary, not exotic: a quoted field containing the delimiter
 * (`"Doe, Jane",42` became three cells), a quoted field containing a newline
 * (one record became two rows), escaped quotes, CRLF (a stray `\r` in every last
 * field), a headerless file (the first data row silently promoted to headings),
 * and `.csv` files that are actually semicolon-delimited.
 *
 * Perspective takes a raw CSV string directly -- `PerspectiveInput` is
 * `@finos/perspective`'s `TableData`, which accepts `string` -- and parses it
 * properly. Passing the text through instead of pre-splitting it removes the
 * whole class of bug rather than fixing the cases someone thought of.
 *
 * `truncated` is forwarded honestly: a body cut mid-record would otherwise
 * present an invented final row as data.
 */
function Tabular({ text, truncated }: { text: string; truncated?: boolean }) {
  return <Perspective data={text} truncated={!!truncated} />
}

function Json({ text }: { text: string }) {
  const classes = useStyles()
  // Parsing can fail on a file named .json, and that is a real state rather than
  // a bug: falling back to the raw text shows the reader what is actually there,
  // which is what they need to see in order to fix it. Throwing would replace the
  // evidence with a stack trace.
  const parsed = React.useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(text) as unknown }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'unknown' }
    }
  }, [text])

  if (!parsed.ok) {
    return (
      <>
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          Not valid JSON ({parsed.message}). Showing the raw contents.
        </M.Typography>
        <pre className={classes.plain}>{text}</pre>
      </>
    )
  }
  // `noS3Links` because this consumer has no bucket routes: JsonDisplay otherwise
  // turns any s3:// string into a link into the bucket UI.
  return <JsonDisplay noS3Links defaultExpanded={1} value={parsed.value} />
}

/**
 * The preview pane for one body.
 *
 * Separate from the identity header so a reader always gets identity even when
 * there is nothing to preview -- the case that motivated the split, since
 * "unpreviewable" must still tell them what the file is.
 */
function Body({ logicalKey, body }: { logicalKey: string; body: DP.EntryBody }) {
  const classes = useStyles()

  if (body.kind === 'opaque') {
    return (
      <M.Typography variant="body2" color="textSecondary">
        No preview for this file type
        {body.mediaHint ? ` (.${body.mediaHint})` : ''}. Its contents are reached through
        the broker rather than rendered here.
      </M.Typography>
    )
  }

  const kind = previewKindFor(logicalKey)
  const truncated = body.truncated && (
    // Stated, because a truncated file rendered as complete is a quiet misreport:
    // a JSON preview silently missing its tail looks like malformed data.
    <M.Typography className={classes.note} variant="body2" color="textSecondary">
      Showing the beginning of this file only.
    </M.Typography>
  )

  return (
    <>
      {truncated}
      {kind === 'markdown' && <Markdown data={body.text} />}
      {kind === 'json' && <Json text={body.text} />}
      {/* No delimiter argument: Perspective sniffs it, which also fixes the
          `.csv`-that-is-actually-semicolon-delimited case the old hardcoded
          comma got wrong. */}
      {kind === 'tabular' && <Tabular text={body.text} truncated={body.truncated} />}
      {(kind === 'text' || kind === 'none') && (
        <pre className={classes.plain}>{body.text}</pre>
      )}
    </>
  )
}

interface EntryViewProps {
  product: DP.DataProduct
  member: DP.Member
  entry: DP.ContentEntry
}

/**
 * A file's identity plus its preview.
 *
 * Suspends on `useEntryBody`; the caller owns the boundary.
 *
 * Identity is rendered *before* and independently of the body, because it is the
 * part that always exists. A reader who cannot preview a 4 GB TIFF still needs
 * its size and its pinned URI -- that is what they copy into a notebook or hand
 * to a colleague.
 */
export default function EntryView({ product, member, entry }: EntryViewProps) {
  const classes = useStyles()
  const result = DP.useEntryBody(product.id, member.logicalName, entry.logicalKey)

  return (
    <div className={classes.root}>
      <div className={classes.head}>
        <div className={classes.name}>{entry.logicalKey}</div>
        <div className={classes.facts}>
          {/* Real values only. An unsized entry shows no size rather than a
              zero -- the manifest genuinely did not say. */}
          {entry.sizeBytes !== undefined
            ? readableBytes(entry.sizeBytes)
            : 'Size not reported'}
        </div>
        {entry.usl && (
          // The entry's addressable identity, and what makes a reference to it
          // reproducible: registry, package, immutable revision, path.
          <span className={classes.usl}>{entry.usl}</span>
        )}
      </div>
      <div className={classes.body}>
        {result.ok ? (
          <Body logicalKey={entry.logicalKey} body={result.body} />
        ) : (
          // Reuses the same four reasons the listing uses, so a refused file and a
          // refused listing say the same thing and name the same person to ask.
          <>
            <M.Typography variant="subtitle2">
              {DP.UNAVAILABLE[result.reason].title}
            </M.Typography>
            <M.Typography variant="body2" color="textSecondary">
              {DP.UNAVAILABLE[result.reason].body}
            </M.Typography>
            {DP.UNAVAILABLE[result.reason].remedy && (
              <M.Typography variant="body2" color="textSecondary">
                {DP.UNAVAILABLE[result.reason].remedy}
              </M.Typography>
            )}
          </>
        )}
      </div>
    </div>
  )
}
