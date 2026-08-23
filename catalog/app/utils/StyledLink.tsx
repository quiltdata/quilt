import cx from 'classnames'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

export const linkStyle = {
  '&, &:visited': {
    color: M.colors.blue[900],
    cursor: 'pointer',
  },
  '&:hover, &:focus': {
    color: M.colors.blue[500],
  },
}

const useStyles = M.makeStyles((t) => ({
  root: linkStyle,
  // A <button> standing in for inline link text: strip the UA's chrome so it
  // still reads as prose, and give it the focus ring the Focus Ring Rule
  // requires (a native button's default outline is suppressed by `outline: 0`
  // elsewhere in the app, so it has to be explicit).
  resetButton: {
    background: 'none',
    border: 0,
    font: 'inherit',
    padding: 0,
    textAlign: 'inherit',
    '&:focus-visible': {
      borderRadius: t.shape.borderRadius,
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
}))

type StyledLinkProps<C extends React.ElementType> = {
  component?: C
  className?: string
} & Omit<React.ComponentProps<C>, 'component'>

export default React.forwardRef(function StyledLink<C extends React.ElementType>(
  { component, className, ...props }: StyledLinkProps<C>,
  ref: React.Ref<C>,
) {
  const classes = useStyles()
  // An `onClick` with no destination is an action, not a link. Rendering it as a
  // bare `<a>` (no href) produced an element that is NOT focusable and has no
  // role -- the DOM reports tabIndex 0 because that's the reflected default for
  // an anchor, but `.focus()` does not land on it. That made every recovery
  // action on the no-results and search-error screens keyboard-unreachable: no
  // way to change result type, reset filters, retry, or start over.
  //
  // A <button> is the correct element for an action; `linkStyle` keeps it
  // looking like inline text, and `resetButton` strips the UA chrome a native
  // button would otherwise bring into a paragraph.
  const isAction = !component && !props.to && !props.href && !!props.onClick
  const Component = component || (props.to ? RRDom.Link : isAction ? 'button' : 'a')
  return (
    <Component
      className={cx(className, classes.root, isAction && classes.resetButton)}
      {...(isAction ? { type: 'button' as const } : null)}
      {...props}
      ref={ref}
    />
  )
})
