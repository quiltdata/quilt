/* Package - about a package */
import { Tabs, Tab } from 'material-ui/Tabs';
import PropTypes from 'prop-types';
import React from 'react';
import { Row, Col } from 'react-bootstrap';
import {
  FormattedMessage,
  FormattedPlural,
} from 'react-intl';
import { Helmet } from 'react-helmet';
import { connect } from 'react-redux';
import { withHandlers } from 'recompose';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import apiStatus from 'constants/api';
import { getLog, getPackage, getTraffic } from 'containers/App/actions';
import Error from 'components/Error';
import { Pad } from 'components/LayoutHelpers';
import Markdown from 'components/Markdown';
import PackageHandle from 'components/PackageHandle';
import { selectPackage, selectPackageTraffic } from 'containers/App/selectors';
import { username } from 'containers/Auth/selectors';
import Working from 'components/Working';
import { injectReducer } from 'utils/ReducerInjector';
import { injectSaga } from 'utils/SagaInjector';
import { composeComponent } from 'utils/reactTools';

import Comments from './Comments';
import Install from './Install';
import Log from './Log';
import Traffic from './Traffic';
import UpdateInfo from './UpdateInfo';

import { addComment, getComments } from './actions';
import { REDUX_KEY } from './constants';
import strings from './messages';
import reducer from './reducer';
import saga from './saga';
import * as selectors from './selectors';

const Header = styled.div`
  .icon {
    opacity: 0.5;
  }
`;

const Tree = styled.pre`
  border-radius: 0;
  border: none;
  line-height: 1em;
`;

const Message = styled.p`
  opacity: 0.5;
`;

export class Package extends React.PureComponent {
  componentDidMount() {
    const { dispatch, match: { params: { name, owner } } } = this.props;
    dispatch(getPackage(owner, name));
    dispatch(getLog(owner, name));
    dispatch(getTraffic(owner, name));
    dispatch(getComments(owner, name));
  }
  componentWillReceiveProps(nextProps) {
    const { dispatch, match: { params: { name, owner } }, user } = this.props;
    const { match: { params: { name: oldName, owner: oldOwner } }, user: oldUser } = nextProps;
    // if package has changed or user has changed
    // HACK we are using user as a poor proxy for signedIn state (also available)
    // but that does not cover all cases as a page could 404 for one user id
    // but be available for another
    if (name !== oldName || owner !== oldOwner || user !== oldUser) {
      dispatch(getPackage(owner, name));
      dispatch(getComments(owner, name));
    }
  }
  printManifest(buffer, nodes, indent = '') {
    for (let i = 0; i < nodes.length; i += 1) {
      const [name, children] = nodes[i];
      const lastNode = i === (nodes.length - 1);
      const stem = lastNode ? '└─' : '├─';
      const nextIndent = lastNode ? `${indent}  ` : `${indent}│ `;
      buffer.push(`${indent}${stem}${name}\n`);
      if (children) {
        this.printManifest(buffer, children, nextIndent);
      }
    }
  }
  renderReadme(manifest) {
    const { status, error = {}, response = {} } = manifest;
    switch (status) {
      case undefined:
      case apiStatus.WAITING:
        return <Working />;
      case apiStatus.ERROR:
        return <Error {...error} />;
      default:
        break;
    }

    if (response.readme_preview) {
      return <Markdown data={response.readme_preview} />;
    // eslint-disable-next-line no-else-return
    } else {
      return <Message><FormattedMessage {...strings.noReadme} /></Message>;
    }
  }
  render() {
    const {
      pkg,
      traffic,
      user,
      comments,
      boundAddComment,
      boundGetComments,
      match: { params },
    } = this.props;
    const { status, error = {}, response = {} } = pkg;
    switch (status) {
      case undefined:
      case apiStatus.WAITING:
        return <Working />;
      case apiStatus.ERROR:
        return <Error {...error} />;
      default:
        break;
    }
    const { updated_at: ts, updated_by: author, hash } = response;
    const { name, owner } = params;
    const time = ts * 1000;
    const { manifest = {}, log = {} } = pkg;
    manifest.response = manifest.response || {};
    log.response = log.response || {};

    const logLength = manifest.response.log_count || 1;

    const previewBuffer = [];
    if (manifest.response.preview) {
      this.printManifest(previewBuffer, manifest.response.preview);
    }

    return (
      <Row>
        <Helmet>
          <title>{owner}/{name} | Quilt</title>
          <meta name="description" content="Quilt data package" />
          <meta name="author" content={owner} />
        </Helmet>
        <Col xs={12} md={7}>
          <Header>
            <h1>
              <PackageHandle
                drop
                isPublic={response.is_public}
                isTeam={response.is_team}
                linkUser
                name={name}
                owner={owner}
              />
            </h1>
          </Header>
          <Tabs>
            <Tab label="Readme">
              <Pad top right left bottom pad="1em">
                { this.renderReadme(manifest || {}) }
              </Pad>
            </Tab>
            <Tab
              label={
                <span>
                  {logLength}&nbsp;
                  <FormattedPlural
                    value={logLength}
                    one="revision"
                    other="revisions"
                  />
                </span>
              }
            >
              <Log entries={log.response.logs} />
            </Tab>
            <Tab label="Comments">
              <Comments
                comments={comments}
                addComment={boundAddComment}
                getComments={boundGetComments}
                user={user}
                owner={owner}
              />
            </Tab>
          </Tabs>
        </Col>
        <Col xs={12} md={5}>
          <Row>
            <Col xs={12}>
              <Install name={name} owner={owner} />
            </Col>
            <Col xs={12}>
              <Traffic {...traffic} />
            </Col>
            <Col xs={12}>
              <UpdateInfo
                author={author}
                time={time}
                fileTypes={manifest.response.file_types}
                size={manifest.response.total_size_uncompressed}
                version={hash}
              />
            </Col>
            <Col xs={12}>
              <h2><FormattedMessage {...strings.contents} /></h2>
              <Tree>{previewBuffer.join('')}</Tree>
            </Col>
          </Row>
        </Col>
      </Row>
    );
  }
}

Package.propTypes = {
  dispatch: PropTypes.func.isRequired,
  pkg: PropTypes.object,
  match: PropTypes.shape({
    params: PropTypes.shape({
      name: PropTypes.string.isRequired,
      owner: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  user: PropTypes.string,
  traffic: PropTypes.object,
  comments: PropTypes.object.isRequired,
  boundAddComment: PropTypes.func.isRequired,
  boundGetComments: PropTypes.func.isRequired,
};

export default composeComponent('Package',
  injectReducer(REDUX_KEY, reducer),
  injectSaga(REDUX_KEY, saga),
  connect(createStructuredSelector({
    pkg: selectPackage,
    traffic: selectPackageTraffic,
    user: username,
    comments: selectors.comments,
  })),
  withHandlers({
    boundAddComment: ({ dispatch, match: { params: { name, owner } } }) => (contents) =>
      new Promise((resolve, reject) => {
        dispatch(addComment({ owner, name, contents }, { resolve, reject }));
      }),
    boundGetComments: ({ dispatch, match: { params: { name, owner } } }) => () =>
      dispatch(getComments(owner, name)),
  }),
  Package);
