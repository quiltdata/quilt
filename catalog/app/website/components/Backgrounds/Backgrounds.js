import backlight1 from './backlight1.png'
import backlight2 from './backlight2.png'
import backlight3 from './backlight3.png'
import backlight4 from './backlight4.png'
import overlay1 from './overlay1.png'
import overlay2 from './overlay2.png'
import dots from './dots.png'

const ASSET_WIDTH = 1920

const img2x = (x1, x2) => (window.devicePixelRatio >= 1.5 ? x2 : x1)

const offset = (o = 0) => `calc(${o}px - (${ASSET_WIDTH}px - 100vw) / 2)`

const Backlight1 = styled('div')({
  backgroundImage: `url(${backlight1})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1449,
  left: 0,
  position: 'absolute',
  right: 0,
})

const Pattern = styled('div')({
  backgroundImage: `url(${dots})`,
  backgroundRepeat: 'repeat',
  backgroundSize: 101,
  height: 1790,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const Overlay1 = styled('div')({
  backgroundImage: `url(${overlay1})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 741,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const Overlay2 = styled('div')({
  backgroundImage: `url(${overlay2})`,
  backgroundPosition: `top left ${offset()}`,
  backgroundSize: 'cover',
  height: 1105,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const Arrow = styled((props) => <Icon {...props}>arrow_forward</Icon>)(
  ({ theme: t }) => ({
    color: t.palette.common.white,
    marginLeft: '0.5em',
    verticalAlign: 'top',
  }),
)
