/* Loading */
import React from 'react';
import RefreshIndicator from 'material-ui/RefreshIndicator';
import styled from 'styled-components';

const Container = styled.div`
  position: relative;
`;

const style = {
  display: 'inline-block',
  position: 'relative',
};

function Loading(props) {
  return (
    <Container>
      <RefreshIndicator
        size={40}
        left={0}
        top={0}
        status="loading"
        style={style}
        {...props}
      />
    </Container>
  );
}

Loading.propTypes = {

};

export default Loading;
