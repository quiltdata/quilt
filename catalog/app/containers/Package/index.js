/* Package - about a package */
import FlatButton from 'material-ui/FlatButton';
import { Tabs, Tab } from 'material-ui/Tabs';
import PropTypes from 'prop-types';
import React from 'react';
import { Row, Col } from 'react-bootstrap';
import {
  FormattedDate,
  FormattedMessage,
  FormattedNumber,
  FormattedPlural,
  FormattedRelative
} from 'react-intl';
import { Helmet } from 'react-helmet';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import apiStatus from 'constants/api';
import { getPackage } from 'containers/App/actions';
import config from 'constants/config';
import Ellipsis from 'components/Ellipsis';
import Error from 'components/Error';
import Markdown from 'components/Markdown';
import MIcon from 'components/MIcon';
import PackageHandle from 'components/PackageHandle';
import { makeSelectPackage, makeSelectUserName } from 'containers/App/selectors';
import { makeHandle } from 'utils/string';
import { installQuilt } from 'constants/urls';
import Working from 'components/Working';

import strings from './messages';

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
  componentWillMount() {
    const { dispatch, match: { params: { name, owner } } } = this.props;
    dispatch(getPackage(owner, name));
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
    const { pkg, match: { params } } = this.props;
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
    const time = ts*1000;
    const { manifest = { response: {} } } = pkg;
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
            <Tab label='Readme'>
                { this.renderReadme(manifest || {}) }
            </Tab>
            <Tab label={<FormattedPlural value={1} one='version' other ='versions' />} >
            </Tab>
          </Tabs>
        </Col>
        <Col xs={12} md={5}>
          <Row>
            <Col xs={12}>
              <Install name={name} owner={owner} />
              <UpdateInfo
                author={author}
                time={time}
                fileTypes={manifest.response.file_types}
                size={manifest.response.total_size_uncompressed}
                version={hash}
              />
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
};

const mapStateToProps = createStructuredSelector({
  pkg: makeSelectPackage(),
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
    <h2>
      <FormattedMessage {...strings.getData} />
    </h2>
    <p>
      <FormattedMessage {...strings.install} />&nbsp;
      <a href={installQuilt}>
        <FormattedMessage {...strings.installLink} />
      </a>&nbsp;
      <FormattedMessage {...strings.installThen} />
    </p>
    <Code>
      <Unselectable>$ </Unselectable>quilt install {makeHandle(owner, name)}
    </Code>
    <p><FormattedMessage {...strings.sell} /></p>
    <h3><FormattedMessage {...strings.access} /></h3>
    <Tabs>
      <Tab label="Python">
        {
          config.team ?
            <Code>from quilt.team.{config.team.id}.{owner} import {name}</Code>
            : <Code>from quilt.data.{owner} import {name}</Code>
        }
      </Tab>
    </Tabs>
  </div>
);

Install.propTypes = {
  name: PropTypes.string.isRequired,
  owner: PropTypes.string.isRequired,
};


function readableBytes(bytes) {
  if (Number.isInteger(bytes) && bytes > -1) {
    // https://en.wikipedia.org/wiki/Kilobyte
    const sizes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    const log = bytes === 0 ? 0 : Math.log10(bytes);
    const index = Math.min(Math.floor(log / 3), sizes.length - 1);
    const display = (bytes / (10 ** (index * 3))).toFixed(1);
    return (
      <span>
        <FormattedNumber value={display} />&nbsp;{sizes[index]}B
      </span>
    )
  }
  return '?';
}

const Line = styled.span`
  display: block;
  span {
    display: inline-block;
    width: 5em;
  }
`;

function readableExtensions(fileCounts = {}) {
  const keys = Object.keys(fileCounts);
  keys.sort();
  return keys.map((k) => {
    const key = k || 'None';
    const count = <FormattedNumber value={fileCounts[k]} />;
    return <Line key={key}><span>{key}</span>{count}</Line>;
  });
}

const UpdateInfo = ({
  author,
  fileTypes,
  size,
  time,
  version,
}) => {
  const date = (
    <FormattedDate
      value={new Date(time)}
      month="long"
      day="numeric"
      year="numeric"
      hour="numeric"
      minute="numeric"
    />
  );
  const since = <FormattedRelative value={time} />;
  return (
    <div>
      <h2><FormattedMessage {...strings.latest} /></h2>
      <dl>
        <dt>{since}</dt>
        <dd>{date}</dd>
        <dt><FormattedMessage {...strings.author} /></dt>
        <dd>{config.team ? `${config.team.id}:` : ''}{author}</dd>

        <dt><FormattedMessage {...strings.version} /></dt>
        <dd>
          <Ellipsis title={version}>
            {version}
          </Ellipsis>
        </dd>
        <dt><FormattedMessage {...strings.stats} /></dt>
        <dd title="deduplicated, uncompresssed">
          {readableBytes(size)}
        </dd>
        <dt><FormattedMessage {...strings.fileStats} /></dt>
        <dd>
          {readableExtensions(fileTypes)}
        </dd>
      </dl>
    </div>
  );
};

UpdateInfo.propTypes = {
  author: PropTypes.string,
  date: PropTypes.string,
  fileTypes: PropTypes.object,
  size: PropTypes.number,
  version: PropTypes.string,
};

export default connect(mapStateToProps, mapDispatchToProps)(Package);
