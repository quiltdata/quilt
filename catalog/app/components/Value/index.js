/* Value propositions of the product */
import React from 'react';
import { Row, Col } from 'react-bootstrap';
import styled from 'styled-components';

import { CenterText } from 'components/LayoutHelpers';
import { h2HomeSize } from 'constants/style';

const Icon = styled.img`
  height: 128px;
  width: 128px;
`;

const Title = styled(CenterText)`
  h2 {
    font-size: ${h2HomeSize}; 
  }
`;

const Detail = styled.div`
  * p {
    font-size: 1.1em;
    height: 6em;
    margin: 0 0 1em 0;
  }
`;

const Height = styled.div`
  filter: grayscale(33%);
  /*  HACK fragile magic number tested by hand;
   * better to get actual heights in JS but that requires hooking window resize
   * and could be slow */
  height: 400px;
`;

/* Value - a singular value proposition for use in Values */
const Value = ({ children, src, title }) => (
  <Row>
    <Col xs={12}>
      <Height>
        <Title>
          <Icon src={src} />
          <h2>{title}</h2>
        </Title>
        <Detail>{React.Children.toArray(children)}</Detail>
      </Height>
    </Col>
  </Row>
);

Value.propTypes = {
  children: React.PropTypes.node,
  src: React.PropTypes.string,
  title: React.PropTypes.node,
};

export default Value;
