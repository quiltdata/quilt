/* Package - about a package */
import { Tabs, Tab } from 'material-ui/Tabs';
import React, { PropTypes } from 'react';
import { Row, Col } from 'react-bootstrap';
import { FormattedMessage } from 'react-intl';
import { Helmet } from 'react-helmet';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import apiStatus from 'constants/api';
import { getPackage } from 'containers/App/actions';
import Ellipsis from 'components/Ellipsis';
import Error from 'components/Error';
import Help from 'components/Help';
import Markdown from 'components/Markdown';
import MIcon from 'components/MIcon';
import PackageHandle from 'components/PackageHandle';
import { makeSelectPackage, makeSelectReadMe, makeSelectUserName } from 'containers/App/selectors';
import { blogManage, installQuilt } from 'constants/urls';
import Working from 'components/Working';

import strings from './messages';

const Header = styled.div`
  .icon {
    opacity: 0.5;
  }
  h1 {
    margin-bottom: 0;
  }
`;

const Tree = styled.pre`
  border-radius: 0;
  border: none;
  line-height: 1em;
`;

export class Package extends React.PureComponent {
  componentWillMount() {
    const { dispatch, params: { name, owner } } = this.props;
    dispatch(getPackage(owner, name));
  }
  componentWillReceiveProps(nextProps) {
    const { dispatch, params: { name, owner }, user } = this.props;
    const { params: { name: oldName, owner: oldOwner }, user: oldUser } = nextProps;
    // if package has changed or user has changed
    // HACK we are using user as a poor proxy for signedIn state (also available)
    // but that does not cover all cases as a page could 404 for one user id
    // but be available for another
    if (name !== oldName || owner !== oldOwner || user !== oldUser) {
      dispatch(getPackage(owner, name));
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
  render() {
    const { pkg, params, readme = {} } = this.props;
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
    const date = new Date(ts * 1000).toLocaleString();
    const { manifest } = pkg;
    const previewBuffer = [];
    if (manifest && manifest.response && manifest.response.preview) {
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
            <h1><PackageHandle name={name} owner={owner} /></h1>
          </Header>
          <Markdown
            data={readme.response || ''}
            status={readme.status}
            useStatus
          />
          <h1><FormattedMessage {...strings.contents} /></h1>
          <Tree>{previewBuffer.join('')}</Tree>
        </Col>
        <Col xs={12} md={5}>
          <Row>
            <Col xs={12}>
              <Install name={name} owner={owner} />
              <UpdateInfo
                author={author}
                date={date}
                version={hash}
              />
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
  params: PropTypes.object.isRequired,
  readme: PropTypes.object,
  user: PropTypes.string,
};

const mapStateToProps = createStructuredSelector({
  pkg: makeSelectPackage(),
  readme: makeSelectReadMe(),
  user: makeSelectUserName(),
});

function mapDispatchToProps(dispatch) {
  return {
    dispatch,
  };
}

const Code = styled.code`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 1em;
`;

const Unselectable = styled.span`
  user-select: none;
`;

const Install = ({ name, owner }) => (
  <div>
    <h1>
      <MIcon>file_download</MIcon>&nbsp;
      <FormattedMessage {...strings.getData} />
    </h1>
    <p>
      <FormattedMessage {...strings.install} />&nbsp;
      <a href={installQuilt}>
        <FormattedMessage {...strings.installLink} />
      </a>&nbsp;
      <FormattedMessage {...strings.installThen} />
    </p>
    <Code>
      <Unselectable>$ </Unselectable>quilt install {owner}/{name}
    </Code>
    <p><FormattedMessage {...strings.sell} /></p>
    <Help href={blogManage} />
    <h2><FormattedMessage {...strings.access} /></h2>
    <Tabs>
      <Tab label="Python">
        <Code>from quilt.data.{owner} import {name}</Code>
      </Tab>
    </Tabs>
  </div>
);

Install.propTypes = {
  name: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
};

const UpdateInfo = ({ author, date, version }) => (
  <div>
    <h1><FormattedMessage {...strings.latest} /></h1>
    <dl>
      <dt><FormattedMessage {...strings.date} /></dt>
      <dd>{date}</dd>

      <dt><FormattedMessage {...strings.author} /></dt>
      <dd>@{author}</dd>

      <dt><FormattedMessage {...strings.version} /></dt>
      <dd>
        <Ellipsis title={version}>
          {version}
        </Ellipsis>
      </dd>
    </dl>
  </div>
);

UpdateInfo.propTypes = {
  author: PropTypes.string,
  date: PropTypes.string,
  version: PropTypes.string,
};

export default connect(mapStateToProps, mapDispatchToProps)(Package);
