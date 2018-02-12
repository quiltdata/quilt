import PT from 'prop-types';
import React from 'react';
import {
  compose,
  lifecycle,
  pure,
  setDisplayName,
  setPropTypes,
  withStateHandlers,
  withProps,
} from 'recompose';
import styled from 'styled-components';
import { FormattedMessage as FM } from 'react-intl';
import IconButton from 'material-ui/IconButton';

import MIcon from 'components/MIcon';

import messages from './messages';

const PER_PAGE = 10;
const UNIT_SIZE = '24px';

const Controls = styled.div`
  display: flex;
  margin-top: 16px;
`;

const Chevron = compose(
  setPropTypes({
    direction: PT.oneOf(['left', 'right']).isRequired,
  }),
  withProps(({ direction }) => ({
    children: <MIcon>{`chevron_${direction}`}</MIcon>,
    style: {
      height: UNIT_SIZE,
      padding: 0,
      width: UNIT_SIZE,
    },
  })),
)(IconButton);

const Pages = styled.span`
  margin-left: 12px;
`;

export default compose(
  setPropTypes({
    items: PT.array.isRequired,
    children: PT.func.isRequired,
  }),
  withProps(({ items }) => ({
    pages: Math.max(1, Math.ceil(items.length / PER_PAGE)),
  })),
  withStateHandlers(
    { page: 1 },
    {
      nextPage: ({ page }, { pages }) => () => ({ page: Math.min(pages, page + 1) }),
      prevPage: ({ page }) => () => ({ page: Math.max(1, page - 1) }),
      resetPage: () => () => ({ page: 1 }),
    },
  ),
  pure,
  lifecycle({
    componentWillReceiveProps({ items }) {
      if (items !== this.props.items) this.props.resetPage();
    },
  }),
  withProps(({ page, items }) => {
    const offset = (page - 1) * PER_PAGE;
    return {
      items: items.slice(offset, offset + PER_PAGE),
    };
  }),
  setDisplayName('Pagination'),
)(({
  items,
  page,
  pages,
  nextPage,
  prevPage,
  children,
}) => (
  <div>
    {children({ items })}
    {!!items.length && pages > 1 &&
      <Controls>
        <Chevron
          direction="left"
          onClick={prevPage}
          disabled={page <= 1}
        />
        <Chevron
          direction="right"
          onClick={nextPage}
          disabled={page >= pages}
        />
        <Pages>{page} <FM {...messages.of} /> {pages}</Pages>
      </Controls>
    }
  </div>
));
