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

const useStyles = M.makeStyles({ root: linkStyle })

type StyledLinkProps<C extends React.ElementType> = {
  component?: C
  className?: string
} & Omit<React.ComponentProps<C>, 'component'>

export default React.forwardRef(function StyledLink<C extends React.ElementType>(
  { component, className, ...props }: StyledLinkProps<C>,
  ref: React.Ref<C>,
) {
  const classes = useStyles()
  const Component = component || (props.to ? RRDom.Link : 'a')
  return <Component className={cx(className, classes.root)} {...props} ref={ref} />
})
