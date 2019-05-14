import Loadable from 'react-loadable';

import Progress from 'components/LoadableProgress';

export default Loadable({
  loader: () => import('./index'),
  loading: Progress,
});
