import { withProps } from 'recompose';
import { reducer } from 'redux-form/immutable';

import { composeComponent } from 'utils/reactTools';
import { InjectReducer } from 'utils/ReducerInjector';

export default composeComponent('ReduxFormProvider',
  withProps({ mount: 'form', reducer }),
  InjectReducer);
