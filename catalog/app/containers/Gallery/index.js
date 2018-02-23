/* Gallery of packages on Quilt */
import PropTypes from 'prop-types';
import React from 'react';
import { Col, Row } from 'react-bootstrap';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import config from 'constants/config';
import { makeHandle } from 'utils/string';

import { getLatest } from './actions';
import feed from './feed';
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
          href={`${window.location.origin}/package/${handle}`}
          key={handle}
          team={Boolean(config.team)}
        >
          <h1>{makeHandle(owner, name)}</h1>
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

const Card = styled.a`
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
  }

  &, &:visited, &:hover, &:focus {
    color: black;
    text-decoration: none; /* No underlines on the link */
  }

  h1 {
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

export default connect(mapStateToProps, mapDispatchToProps)(Gallery);
