import cfg from 'constants/config'

import Marketing from './Marketing'
import Product from './Product'

export default (() => {
  // TODO: not sure if dead code elimintation handles this
  switch (cfg.mode) {
    case 'MARKETING':
      return Marketing
    case 'PRODUCT':
      return Product
  }
})()
