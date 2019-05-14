import React from 'react';
import { Row } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';

import { backgroundColor, breaks } from 'constants/style';

import strings from './messages';

const sm = `${breaks.sm - 1}px`;
export const id = 'QuiltLead';

const Style = styled.div`
  background-color: ${backgroundColor};
  color: #ccc;
  font-size: 1.5em;
  font-family: 'Roboto Slab';
  padding: 3em;
  
  @media (max-width:${sm}) {
    font-size: 1.2em;
  }
`;

const Lead = () => (
  <Row id={id}>
    <Style>
      <span>
        <FormattedMessage {...strings.knowledge} />
      </span>
    </Style>
  </Row>
);

export default Lead;
