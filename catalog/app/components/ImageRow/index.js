import PropTypes from 'prop-types';
import React from 'react';
import { Row } from 'react-bootstrap';
import styled from 'styled-components';

import { backgroundColor as bgc } from 'constants/style';

const Back = styled.div`
  background-color: ${(props) => props.backgroundColor};
  background-image: url(${(props) => props.src});
  background-repeat: no-repeat;
  background-size: cover;
  height: ${(props) => props.height};
  padding-top: ${(props) => props.paddingTop};
`;

/* Rows with images as their background */
// TODO better to just spread props to Back than pipe by hand
// eslint-disable-next-line object-curly-newline
const ImageRow = ({ backgroundColor, children, height, src }) => (
  <Row>
    <Back backgroundColor={backgroundColor} height={height} src={src}>
      { React.Children.toArray(children) }
    </Back>
  </Row>
);

ImageRow.propTypes = {
  backgroundColor: PropTypes.string,
  children: PropTypes.any,
  height: PropTypes.string,
  src: PropTypes.string.isRequired,
};

ImageRow.defaultProps = {
  backgroundColor: bgc,
};

export default ImageRow;
