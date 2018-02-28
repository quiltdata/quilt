import PT from 'prop-types';
import React from 'react';
import {
  compose,
  setDisplayName,
  setPropTypes,
  withProps,
} from 'recompose';
import styled from 'styled-components';
import { FormattedMessage as FM } from 'react-intl';
import IconButton from 'material-ui/IconButton';

import MIcon from 'components/MIcon';

import messages from './messages';

const UNIT_SIZE = '24px';

const Container = styled.div`
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
    page: PT.number.isRequired,
    pages: PT.number.isRequired,
    nextPage: PT.func.isRequired,
    prevPage: PT.func.isRequired,
  }),
  setDisplayName('Pagination.Controls'),
// eslint-disable-next-line object-curly-newline
)(({ page, pages, nextPage, prevPage }) => pages <= 1 ? null : (
  <Container>
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
  </Container>
));
