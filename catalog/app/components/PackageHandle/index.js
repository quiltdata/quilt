/* PackageHandle - Generate package handles in the right style */
import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import { setPropTypes } from 'recompose';
import styled from 'styled-components';

import config from 'constants/config';
import MIcon from 'components/MIcon';
import { composeComponent } from 'utils/reactTools';

const toIcon = {
  private: 'lock',
  public: 'public',
  team: 'people',
};

const VisibilityIcon = composeComponent('PackageHandle.VisibilityIcon',
  setPropTypes({
    visibility: PropTypes.oneOf(Object.keys(toIcon)),
  }),
  ({ visibility }) => {
    const icon = toIcon[visibility];
    const opacity = icon ? 0.5 : 1;
    return (
      <MIcon
        style={{ fontSize: 'inherit', opacity }}
        title={visibility}
      >
        {icon || 'check_box_outline_blank' }
      </MIcon>
    );
  });

const Lighter = styled.span`
  opacity: 0.7;
  a, a:active, a:hover, a:visited {
    text-decoration: none;
  }
`;

const Preview = styled.span`
  margin-left: 16px;
  opacity: 0.5;
`;

const Text = styled.span`
  align-items: center;
  display: inline-flex;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const team = config.team ? `${config.team.id}:` : '';

export default composeComponent('PackageHandle',
  setPropTypes({
    isPublic: PropTypes.bool,
    isTeam: PropTypes.bool,
    linkUser: PropTypes.bool,
    name: PropTypes.string.isRequired,
    owner: PropTypes.string.isRequired,
    readmePreview: PropTypes.string,
    showPrefix: PropTypes.bool,
  }),
  ({
    isPublic = true,
    isTeam,
    linkUser = false,
    name,
    owner,
    readmePreview,
    showPrefix = true,
  }) => {
    const prefix = showPrefix ? `${team}${owner}/` : null;

    let visibility = 'private';
    if (isPublic === true) {
      visibility = 'public';
    } else if (isTeam === true) {
      visibility = 'team';
    }

    return (
      <Text>
        <VisibilityIcon visibility={visibility} />
        &nbsp;
        {prefix && (
          <Lighter>
            {linkUser
              ? <Link to={`/package/${owner}/`}>{prefix}</Link>
              : prefix
            }
          </Lighter>
        )}
        {name}
        {readmePreview && <Preview>{readmePreview}</Preview>}
      </Text>
    );
  });
