import * as React from 'react'
import { Link, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'
import { unstable_Box as Box } from '@material-ui/core/Box'

import * as Layout from 'components/Layout'

import Bar from './Bar'

import backlight2 from './backlight2.png'
// import pkgArt1 from './packages-illustration1.png'
// import pkgArt1x2 from './packages-illustration1@2x.png'
// import pkgArt2 from './packages-illustration2.png'
// import pkgArt2x2 from './packages-illustration2@2x.png'
// import pkgArt3 from './packages-illustration3.png'
// import pkgArt3x2 from './packages-illustration3@2x.png'

const Backlight2 = styled('div')({
  backgroundImage: `url(${backlight2})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1872,
  left: 0,
  position: 'absolute',
  right: 0,
})

export default () => (
  <Layout.Container>
    <Backlight2 />
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      pt={18}
      pb={10}
      position="relative"
    >
      <Bar color="secondary" />
      <Box mt={5}>
        <Typography variant="h1">Browse packages</Typography>
      </Box>
      <Box mt={3}>
        <Link href="TBD" color="secondary" variant="button" underline="none">
          View All
        </Link>
      </Box>
      <Box mt={5} height={350}>
        packages TODO
      </Box>
    </Box>
  </Layout.Container>
)

/*
(
  <div className="package-carousel">
    <div className="carousel-cell hide-below-1400 carousel-shadow-left">
    </div>
    <div className="carousel-cell  ">
      <div className="cell-img-cont">
        <img src={pkgImg_1} />
      </div>
      <div className="text-blue mt-10 ">knaaptime/census</div>
      <div className="sub-heading mt-10 ">aics/aics_24</div>
    </div>
    <div className="carousel-cell hide-below-1400 carousel-shadow-right">
    </div>
  </div>
)
*/

/* PACKAGES
.package-carousel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: 50px;
  margin-bottom: 100px;
  align-items: center;
}

.carousel-cell {
  width: 250px;
  height: 250px;
  margin-top: 15px;
  margin-bottom: 15px;
  height: 250px;
  opacity: 0.8;
  border-radius: 19px;
  background-image: linear-gradient(to top, #222559, #35377b);
}

.carousel-cell .cell-img-cont img {
  margin-top: 30px;
  border-radius: 50%;
}

.carousel-shadow-left {
    background: linear-gradient(to right, rgba(38,39,89,0) 0%,rgba(38,39,89,1) 100%);
    opacity: .9;
}

.carousel-shadow-right {
  background: linear-gradient(to left, rgba(38,39,89,0) 0%,rgba(38,39,89,1) 100%);
    opacity: .9;
}

@media only screen and (min-width: 700px) {
}

@media only screen and (max-width: 800px) {
  .hide-below-800 {
    display: none;
  }

  .package-carousel {
    justify-content: center;
  }
}

@media only screen and (max-width: 1200px) {
  .hide-below-1200 {
    display: none;
  }
}

@media only screen and (max-width: 1400px) {
  .hide-below-1400 {
    display: none;
  }
  .package-carousel {
  }
}

@media only screen and (min-width: 900px) {
  .package-carousel {
    display: flex;
    justify-content: space-around;
    flex-direction: row;
  }
}
*/
