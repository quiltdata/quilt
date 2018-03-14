import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';
import { compose, withHandlers, withProps, withStateHandlers } from 'recompose';

export const formatDate = (d) => d ? new Date(d).toLocaleString() : 'N/A';

export const withStatefulActions = (bindActions) => compose(
  withStateHandlers({ pending: {} }, {
    startAction: ({ pending }) => (key) => ({
      pending: Object.assign({}, pending, { [key]: true }),
    }),
    endAction: ({ pending }) => (key) => ({
      pending: omit(pending, [key]),
    }),
  }),
  withHandlers(({ actions }) =>
    mapValues(actions, (action, key) =>
      // eslint-disable-next-line object-curly-newline
      ({ pending, startAction, endAction, actions: { [key]: callback } }) => (arg) => {
        if (pending[arg]) return;
        startAction(arg);
        callback(arg)
          .then(() => endAction(arg))
          .catch((e) => { endAction(arg); throw e; });
      })),
  withProps((props) => ({ bindActions: bindActions(props) })),
);
