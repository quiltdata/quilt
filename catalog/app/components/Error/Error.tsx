import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import { printObject } from 'utils/string'

import sand from './sand.jpg'

const Img = styled(M.Box)({
  backgroundImage: `url(${sand})`,
  backgroundRepeat: 'repeat',
  height: 'calc(100vh - 254px)',
  position: 'relative',
  boxShadow: `
    inset 0 0 10px #fff,
    inset 0 0 20px #fff,
    inset 0 0 50px #fff,
    inset 0 0 100px #fff`,
})

interface ErrorProps {
  headline?: React.ReactNode
  detail?: React.ReactNode
  object?: {}
}

export default function Error({
  detail = 'Check network connection and login',
  headline = 'Something went wrong',
  object,
}: ErrorProps) {
  return (
    <>
      <M.Typography variant="h4" gutterBottom>
        {headline}
      </M.Typography>
      <M.Typography variant="body1">{detail}</M.Typography>
      <Img height={600} mt={2} />
      {!!object && <M.Box component="pre">{printObject(object)}</M.Box>}
    </>
  )
}
