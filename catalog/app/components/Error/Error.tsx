import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import { printObject } from 'utils/string'

import sand from './sand.jpg'

const Img = styled(M.Box)({
  backgroundImage: `url(${sand})`,
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
})

interface ErrorProps {
  headline?: React.ReactNode
  detail?: React.ReactNode
  object?: {}
}

// TODO add sign in
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
