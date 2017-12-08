/* Global Footer */
import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import styled from 'styled-components';


import FAIcon from 'components/FAIcon';
import { Stack } from 'components/LayoutHelpers';
import { backgroundColor } from 'constants/style';
import { blog, twitter, gitWeb } from 'constants/urls';

import messages from './messages';

const Link = styled.a`
  color: #ddd;
  font-size: 2em;
  line-height: 2em;
  &:visited {
    color: #ccc;
  }
  &:hover,
  &:focus {
    color: #eee;
  }
`;

const StyledRow = styled(Row)`
  background-color: ${backgroundColor};
  color: #ccc;
  padding: 1em;
  text-align: center;
`;

const Small = styled.p`
  font-size: .8em;
  line-height: 2em;
`;

function Footer() {
  return (
    <StyledRow>
      <Stack margin="1em">
        <Col xs={12} sm={3}>
          <Link href={twitter}>
            <FAIcon type="twitter" />
          </Link>
        </Col>
        <Col xs={12} sm={3}>
          <Link href={gitWeb}>
            <FAIcon type="github" />
          </Link>
        </Col>
        <Col xs={12} sm={3}>
          <Link href={blog}>
            <FAIcon type="medium" />
          </Link>
        </Col>
        <Col xs={12} sm={3}>
          <Small>
            &copy;&nbsp;
            <FormattedMessage {...messages.copy} />
          </Small>
        </Col>
      </Stack>
    </StyledRow>
  );
}

export default Footer;
