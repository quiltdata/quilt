import cx from 'classnames'
import createDOMPurify from 'dompurify'
import 'highlight.js/styles/default.css'
import memoize from 'lodash/memoize'
import * as React from 'react'
import MarkdownIt from 'markdown-it'
import * as M from '@material-ui/core'
import * as Sentry from '@sentry/react'

import Skel from 'components/Skeleton'
import HljsBoundary from 'utils/HljsBoundary'
import hljs, { ensureLanguages } from 'utils/hljs'
import { linkStyle } from 'utils/StyledLink'

import * as tasklist from './parseTasklist'

/* Most of what's in the commonmark spec for HTML blocks;
 * minus troublesome/abusey/not-in-HTML5 tags: basefont, body, center, dialog,
 * dir, fieldset, form, frame, frameset, head, html, iframe, link, main, menu,
 * menuitem, meta, noframes,  optgroup, option, source (we don't support audio),
 * track (we don't support video).
 *
 * I opted not to include UI tags (opt, optgroup); ditto for base, body, head,
 * meta, title
 * which shouldn't be needed
 *
 * NOTE: this allowlist is the union of two categories:
 * (a) tags emitted by the markdown-it parser with the options we enable
 *     (default preset, which already includes ~~strike~~, + linkify + typographer);
 * (b) tags that can reach the sanitizer via raw HTML pass-through (`html: true`)
 *     when authors embed inline HTML in markdown source.
 * Examples in category (b): input, abbr, dd, dl, dt, ins, mark, sub, sup, del.
 * If we add a markdown-it plugin (e.g. markdown-it-abbr, -mark, -sub, -sup,
 * -ins, -deflist, -footnote) the corresponding tags are already covered here.
 */
const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    'input',
    'a',
    'abbr',
    'address',
    'article',
    'aside',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'col',
    'colgroup',
    'dd',
    'details',
    'del',
    'div',
    'dl',
    'dt',
    'em',
    'figure',
    'figcaption',
    'footer',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hr',
    'i',
    'img',
    'ins',
    'legend',
    'li',
    'mark',
    'nav',
    'ol',
    'p',
    'param',
    'pre',
    's',
    'section',
    'span',
    'strong',
    'sub',
    'summary',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
  ],
  FORBID_TAGS: ['style', 'script'],
  FORBID_ATTR: ['style'],
}

// TODO: switch to pluggable react-aware renderer
// TODO: use react-router's Link component for local links
// No `hljs.highlightAuto` fallback: `utils/hljs` registers only a subset of
// grammars, and auto-detection misfires when run against a partial registry.
// Unlabeled or unsupported fences render as plain monospace via markdown-it's
// default escaping. To highlight a new fence label, register it in `utils/hljs`.
const highlight = (str: string, lang: string) => {
  if (hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(str, { language: lang }).value
    } catch (err) {
      console.error(err) // eslint-disable-line no-console
    }
  }
  return ''
}

const checkboxHandler = (md: MarkdownIt) => {
  md.inline.ruler.push('tasklist', tasklist.parse)
  md.renderer.rules[tasklist.CHECKED] = () => '☑'
  md.renderer.rules[tasklist.UNCHECKED] = () => '☐'
}

type AttributeProcessor = (attr: string) => string

function handleImage(process: AttributeProcessor, element: Element) {
  const attributeValue = element.getAttribute('src')
  if (!attributeValue) return

  try {
    element.setAttribute('src', process(attributeValue))
  } catch (e) {
    element.removeAttribute('src')
    Sentry.captureException(e)
  }
}

function handleLink(process: AttributeProcessor, element: HTMLElement) {
  const attributeValue = element.getAttribute('href')
  if (typeof attributeValue !== 'string') return

  try {
    element.setAttribute('href', process(attributeValue))
  } catch (e) {
    element.removeAttribute('href')
    Sentry.captureException(e)
  }

  const rel = element.getAttribute('rel')
  element.setAttribute('rel', rel ? `${rel} nofollow` : 'nofollow')
}

const htmlHandler =
  (processLink?: AttributeProcessor, processImage?: AttributeProcessor) =>
  (currentNode: Element) => {
    const element = currentNode as HTMLElement
    const tagName = currentNode.tagName?.toUpperCase()

    if (processLink && tagName === 'A') handleLink(processLink, element)
    else if (processImage && tagName === 'IMG') handleImage(processImage, element)
  }

interface RendererArgs {
  processImg?: AttributeProcessor
  processLink?: AttributeProcessor
  win?: Window
}

export const getRenderer = memoize(
  ({ processImg, processLink, win = window }: RendererArgs) => {
    const md = new MarkdownIt({
      highlight,
      html: true,
      linkify: true,
      typographer: true,
    })
    md.use(checkboxHandler)
    const purify = createDOMPurify(win as $TSFixMe)
    purify.addHook(
      'uponSanitizeElement',
      htmlHandler(processLink, processImg) as $TSFixMe,
    )
    return (data: string) => {
      // Share one `env` between parse and render, as `md.render` does, so a
      // future env-carrying plugin works across both phases.
      const env = {}
      const tokens = md.parse(data, env)
      ensureLanguages(
        tokens
          .filter((t) => t.type === 'fence')
          .map((t) => t.info.trim().split(/\s+/)[0])
          .filter(Boolean),
      )
      return purify.sanitize(md.renderer.render(tokens, md.options, env), SANITIZE_OPTS)
    }
  },
)

interface ContainerProps {
  children?: string
  className?: string
}

const useContainerStyles = M.makeStyles({
  root: {
    overflow: 'auto',

    '& a': linkStyle,

    '& h1 code': {
      backgroundColor: 'inherit',
    },

    /* prevent horizontal overflow */
    '& img': {
      maxWidth: '100%',
    },

    '& * + h1, & * + h2, & * + h3, & * + h4, & * + h5, & * + h6': {
      marginTop: '8px',
    },

    '& * + p': {
      marginTop: '8px',
    },

    '& li + li': {
      marginTop: '4px',
    },

    '& table': {
      maxWidth: '100%',
      width: '100%',

      'th, td': {
        lineHeight: '1.5em',
        padding: '8px',
        textAlign: 'left',
      },

      '&, th, td': {
        border: '1px solid #ddd',
      },
    },
  },
})

export function Container({ className, children }: ContainerProps) {
  const classes = useContainerStyles()
  return (
    <div
      className={cx(className, classes.root)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: children ?? '' }}
    />
  )
}

interface MarkdownProps extends RendererArgs, Omit<ContainerProps, 'children'> {
  data?: string
}

const useSkeletonStyles = M.makeStyles((t) => ({
  line: {
    height: t.spacing(3),
    marginBottom: t.spacing(1),
  },
}))

// Small (unlike the full-page Preview skeleton) because the default <Markdown>
// also renders inline surfaces such as Chat messages.
function LoadingSkeleton({ className }: Pick<ContainerProps, 'className'>) {
  const classes = useSkeletonStyles()
  return (
    <div className={className}>
      {[80, 50, 95].map((width, index) => (
        <Skel className={classes.line} width={`${width}%`} key={`${width}_${index}`} />
      ))}
    </div>
  )
}

// Separate child so getRenderer's Suspense throw lands inside HljsBoundary — an
// inline call would throw during Markdown's own render, above the boundary.
function MarkdownContent({ data, processImg, processLink, ...props }: MarkdownProps) {
  return (
    <Container {...props}>
      {getRenderer({ processImg, processLink })(data || '')}
    </Container>
  )
}

export default function Markdown(props: MarkdownProps) {
  return (
    <HljsBoundary fallback={<LoadingSkeleton className={props.className} />}>
      <MarkdownContent {...props} />
    </HljsBoundary>
  )
}
