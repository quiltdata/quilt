import { styled } from '@material-ui/styles'

export default styled('div')(({ theme: t }) => ({
  fontFamily: t.typography.monospace.fontFamily,
  fontSize: t.typography.body2.fontSize,
  overflow: 'auto',
  whiteSpace: 'pre',
}))
