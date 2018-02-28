import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';
import PT from 'prop-types';
import React, { Fragment } from 'react';
import {
  compose,
  defaultProps,
  lifecycle,
  pure,
  setDisplayName,
  setPropTypes,
  withStateHandlers,
  withProps,
} from 'recompose';

import { saveProps, restoreProps } from 'utils/reactTools';

import DefaultControls from './Controls';

const PER_PAGE = 10;

// TODO: static vs dynamic pagination
// TODO: support usage as controlled component
export const withPagination = ({
  key = 'items',
  namespace = 'pagination',
  getItemId = (i) => i,
  perPage = PER_PAGE,
  controls: Controls = DefaultControls,
} = {}) => compose(
  saveProps({ keep: [key, 'getItemId', 'perPage'] }),
  defaultProps({
    getItemId,
    perPage,
  }),
  setPropTypes({
    [key]: PT.array.isRequired,
    getItemId: PT.func.isRequired,
    perPage: PT.number.isRequired,
  }),
  // eslint-disable-next-line no-shadow
  withProps(({ perPage, [key]: items }) => ({
    pages: Math.max(1, Math.ceil(items.length / perPage)),
  })),
  withStateHandlers(
    { page: 1 },
    {
      nextPage: ({ page }, { pages }) => () => ({ page: Math.min(pages, page + 1) }),
      prevPage: ({ page }) => () => ({ page: Math.max(1, page - 1) }),
      goToPage: () => (page) => ({ page }),
    },
  ),
  pure,
  lifecycle({
    componentWillReceiveProps({ [key]: items }) {
      // eslint-disable-next-line no-shadow
      const { getItemId, [key]: oldItems, goToPage } = this.props;
      if (!isEqual(items.map(getItemId), oldItems.map(getItemId))) goToPage(1);
    },
  }),
  // eslint-disable-next-line no-shadow
  withProps(({ page, perPage, [key]: items }) => {
    const offset = (page - 1) * perPage;
    return {
      [key]: items.slice(offset, offset + perPage),
    };
  }),
  withProps((props) => {
    const pgProps = pick(props, ['page', 'pages', 'nextPage', 'prevPage', 'goToPage']);
    return { [namespace]: Controls ? <Controls {...pgProps} /> : pgProps };
  }),
  restoreProps({ keep: [namespace, key] }),
);


export default compose(
  withPagination(),
  setPropTypes({
    children: PT.func.isRequired,
  }),
  setDisplayName('Pagination'),
)(({ pagination, items, children }) => (
  <Fragment>
    {children({ items })}
    {pagination}
  </Fragment>
));
