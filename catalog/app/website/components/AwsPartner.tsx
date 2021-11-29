import * as React from 'react'

import img2x from 'utils/img2x'

import partner from 'website/pages/Landing/Platform/partner.png'
import partner2x from 'website/pages/Landing/Platform/partner@2x.png'

export default function AwsPartner(props: React.HTMLAttributes<HTMLImageElement>) {
  return (
    <img
      alt="AWS Advanced Technology Partner"
      src={img2x(partner, partner2x)}
      {...props}
    />
  )
}
