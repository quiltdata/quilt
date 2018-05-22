/* Gallery of packages on Quilt */
import PropTypes from 'prop-types';
import React from 'react';
import { Col, Row } from 'react-bootstrap';
import { connect } from 'react-redux';
import { push } from 'react-router-redux';
import { compose } from 'recompose';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import config from 'constants/config';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { makeHandle } from 'utils/string';

import { getLatest } from './actions';
import { REDUX_KEY } from './constants';
import feed from './feed';
import reducer from './reducer';
import saga from './saga';
import { makeSelectLatest } from './selectors';

const Clip = styled.div`
  overflow-x: auto;
  white-space: nowrap;
`;

export class Gallery extends React.PureComponent {
  componentWillMount() {
    const { dispatch } = this.props;
    // only getLatest if we're on a team instance
    if (config.team) {
      dispatch(getLatest());
    }
  }
  render() {
    const packages = config.team ? this.props.packages : feed;
    // eslint-disable-next-line object-curly-newline, camelcase
    const cards = packages.map(({ name, owner, description, updated_at }) => {
      const handle = `${owner}/${name}`;
      const date = new Date(updated_at).toLocaleString();
      const body = description || `Updated on ${date}`;
      return (
        <Card
          onClick={() => this.props.dispatch(push(`/package/${handle}/`))}
          key={handle}
          team={Boolean(config.team)}
        >
          <h4>{makeHandle(owner, name)}</h4>
          <p>{body}</p>
        </Card>
      );
    });

    return (
      <div>
        <Row>
          <Col xs={12}>
            <Clip>
              {cards}
            </Clip>
          </Col>
        </Row>
      </div>
    );
  }
}

Gallery.propTypes = {
  dispatch: PropTypes.func.isRequired,
  packages: PropTypes.array.isRequired,
};

const Card = styled.div`
  display: inline-block;
  vertical-align: top;
  white-space: normal;
  background-color: white;
  border: 1px solid #ddd;
  height: ${(props) => props.team ? '128px' : '256px'};
  margin: 0em 1em 1em 0em;
  overflow: hidden;
  padding: 1em;
  text-overflow: ellipsis;
  width: 256px;

  &:hover, &:focus {
    background-color: #efefef;
    cursor: pointer;
  }

  &, &:visited, &:hover, &:focus {
    color: black;
    text-decoration: none; /* No underlines on the link */
  }

  h4 {
    font-size: 1em;
  }

  p {
    font-size: .8em;
    opacity: 0.5;
  }
`;

const mapStateToProps = createStructuredSelector({
  packages: makeSelectLatest(),
});

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

export default compose(
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  connect(mapStateToProps, mapDispatchToProps),
)(Gallery);
