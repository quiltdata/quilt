import cx from 'classnames'
import createDOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/default.css'
import memoize from 'lodash/memoize'
import * as React from 'react'
import * as Remarkable from 'remarkable'
import { linkify } from 'remarkable/linkify'
import * as M from '@material-ui/core'

import { linkStyle } from 'utils/StyledLink'

import parseTasklist, { CheckboxContentToken } from './parseTasklist'

/* Most of what's in the commonmark spec for HTML blocks;
 * minus troublesome/abusey/not-in-HTML5 tags: basefont, body, center, dialog,
 * dir, fieldset, form, frame, frameset, head, html, iframe, link, main, menu,
 * menuitem, meta, noframes,  optgroup, option, source (we don't support audio),
 * track (we don't support video).
 *
 * I opted not to include UI tags (opt, optgroup); ditto for base, body, head,
 * meta, title
 * which shouldn't be needed
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
const highlight = (str: string, lang: string) => {
  if (lang === 'none') {
    return ''
  }
  if (hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(str, { language: lang }).value
    } catch (err) {
      // istanbul ignore next
      console.error(err) // eslint-disable-line no-console
    }
  } else {
    try {
      return hljs.highlightAuto(str).value
    } catch (err) {
      // istanbul ignore next
      console.error(err) // eslint-disable-line no-console
    }
  }
  // istanbul ignore next
  return '' // use external default escaping
}

interface RemarkableWithUtils extends Remarkable.Remarkable {
  // NOTE: Remarkable.Remarkable doesn't export utils
  utils: {
    unescapeMd: (str: string) => string
  }
}

const { unescapeMd } = (Remarkable as unknown as RemarkableWithUtils).utils

const checkboxHandler = (md: Remarkable.Remarkable) => {
  md.inline.ruler.push('tasklist', parseTasklist, {})
  md.renderer.rules.tasklist = (tokens, idx) =>
    (tokens[idx] as CheckboxContentToken).checked ? '☑' : '☐'
}

type AttributeProcessor = (attr: string) => string

function handleImage(process: AttributeProcessor, element: Element): Element {
  const attributeValue = element.getAttribute('src')
  if (!attributeValue) return element
  const result = process(attributeValue)
  element.setAttribute('src', result)

  const alt = element.getAttribute('alt')
  if (alt) {
    element.setAttribute('alt', unescapeMd(alt))
  }

  return element
}

function handleLink(process: AttributeProcessor, element: HTMLElement): Element {
  const attributeValue = element.getAttribute('href')
  if (typeof attributeValue !== 'string') return element
  const result = process(attributeValue)
  element.setAttribute('href', result)

  const rel = element.getAttribute('rel')
  element.setAttribute('rel', rel ? `${rel} nofollow` : 'nofollow')

  return element
}

function htmlHandler(
  processLink?: AttributeProcessor,
  processImage?: AttributeProcessor,
) {
  return (currentNode: Element): Element => {
    const element = currentNode as HTMLElement
    const tagName = currentNode.tagName?.toUpperCase()
    if (processLink && tagName === 'A') return handleLink(processLink, element)
    if (processImage && tagName === 'IMG') return handleImage(processImage, element)
    return currentNode
  }
}

interface RendererArgs {
  processImg?: AttributeProcessor
  processLink?: AttributeProcessor
  win?: Window
}

export const getRenderer = memoize(
  ({ processImg, processLink, win = window }: RendererArgs) => {
    const md = new Remarkable.Remarkable('full', {
      highlight,
      html: true,
      typographer: true,
    }).use(linkify)
    md.use(checkboxHandler)
    const purify = createDOMPurify(win)
    purify.addHook('uponSanitizeElement', htmlHandler(processLink, processImg))
    return (data: string) => purify.sanitize(md.render(data), SANITIZE_OPTS)
  },
)

interface ContainerProps {
  children: string
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
      dangerouslySetInnerHTML={{ __html: children }}
    />
  )
}

interface MarkdownProps extends RendererArgs, Omit<ContainerProps, 'children'> {
  data?: string
}

export default function Markdown({
  data,
  processImg,
  processLink,
  ...props
}: MarkdownProps) {
  return (
    <Container {...props}>
      {getRenderer({ processImg, processLink })(data || '')}
    </Container>
  )
}
