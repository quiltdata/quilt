import { styled } from '@material-ui/styles'

export default styled('div')(({ theme: t }) => ({
  fontFamily: t.typography.monospace.fontFamily,
  fontSize: t.typography.body2.fontSize,
  overflowX: 'auto',
  overflowY: 'hidden',
  whiteSpace: 'pre',
}))
