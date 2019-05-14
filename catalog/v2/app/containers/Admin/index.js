/* Admin */
import PT from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import { setPropTypes, withHandlers } from 'recompose';
import styled from 'styled-components';

import config from 'constants/config';
import { push } from 'containers/Notifications/actions';
import { composeComponent } from 'utils/reactTools';
import withParsedQuery from 'utils/withParsedQuery';

import msg from './messages';

import Members from './Members';
import MemberAudit from './MemberAudit';
import Packages from './Packages';
import PackageAudit from './PackageAudit';
import Status from './Status';
import Policies from './Policies';


const teamName = config.team ? config.team.name || config.team.id : '?';

const Show = styled.div`
  h1 {
    overflow: visible;
  }
`;

export default composeComponent('Admin',
  injectIntl,
  withParsedQuery,
  connect(null, { notify: push }),
  setPropTypes({
    plan: PT.string.isRequired,
    notify: PT.func.isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  withHandlers({
    changePolicy: ({ notify, intl: { formatMessage } }) => () => {
      notify(formatMessage(msg.changePolicy));
    },
  }),
  ({
    plan,
    location: { pathname, query: { audit } },
    intl: { formatMessage },
    changePolicy,
  }) => (
    <div>
      <Show>
        <h1>{formatMessage(msg.teamHeader, { name: teamName })} {config.stripeKey ? <Status plan={plan} /> : null}</h1>
      </Show>
      <Members />
      <Packages />
      <Policies
        read
        write={false}
        onReadCheck={changePolicy}
        onWriteCheck={changePolicy}
      />

      <PackageAudit back={pathname} id={audit && audit.includes('/') ? audit : null} />
      <MemberAudit back={pathname} id={audit && !audit.includes('/') ? audit : null} />
    </div>
  ));
