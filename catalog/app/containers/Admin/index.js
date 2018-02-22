/* Admin */
import PT from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { injectIntl } from 'react-intl';
import {
  compose,
  lifecycle,
  setDisplayName,
  setPropTypes,
  withHandlers,
  withProps,
} from 'recompose';

import { push } from 'containers/Notifications/actions';
import config from 'constants/config';

import * as actions from './actions';
import msg from './messages';
import selector from './selectors';
import AddMember from './AddMember';
import AuditDialog from './AuditDialog';
import Members from './Members';
import MemberAudit from './MemberAudit';
import Packages from './Packages';
import PackageAudit from './PackageAudit';
import Policies from './Policies';


const teamName = config.team && config.team.name;

const dispatchPromise = (actionCreator, ...args) =>
  new Promise((resolve, reject) => actionCreator(...args, { resolve, reject }));

export default compose(
  injectIntl,
  connect(selector, { pushNotification: push, ...actions }),
  setPropTypes({
    addMember: PT.func.isRequired,
    members: PT.object.isRequired,
    getMembers: PT.func.isRequired,
    memberAudit: PT.object.isRequired,
    getMemberAudit: PT.func.isRequired,
    disableMember: PT.func.isRequired,
    enableMember: PT.func.isRequired,
    resetMemberPassword: PT.func.isRequired,
    packages: PT.object.isRequired,
    getPackages: PT.func.isRequired,
    packageAudit: PT.object.isRequired,
    getPackageAudit: PT.func.isRequired,
    pushNotification: PT.func.isRequired,
    intl: PT.shape({
      formatMessage: PT.func.isRequired,
    }).isRequired,
  }),
  lifecycle({
    componentWillMount() {
      this.props.getMembers();
      this.props.getPackages();
    },
  }),
  withHandlers({
    disableMember: ({ disableMember, pushNotification, intl: { formatMessage } }) => (name) => {
      // eslint-disable-next-line no-alert, no-restricted-globals
      if (!confirm(formatMessage(msg.disableUserConfirm, { name }))) {
        return Promise.resolve();
      }

      return dispatchPromise(disableMember, name)
        .then(() => {
          pushNotification(formatMessage(msg.disableUserSuccess, { name }));
        })
        .catch(() => {
          pushNotification(formatMessage(msg.disableUserError, { name }));
        });
    },
    enableMember: ({ enableMember, pushNotification, intl: { formatMessage } }) => (name) =>
      dispatchPromise(enableMember, name)
        .then(() => {
          pushNotification(formatMessage(msg.enableUserSuccess, { name }));
        })
        .catch(() => {
          pushNotification(formatMessage(msg.enableUserError, { name }));
        }),
    resetMemberPassword: ({ resetMemberPassword, pushNotification, intl: { formatMessage } }) => (name) =>
      dispatchPromise(resetMemberPassword, name)
        .then(() => {
          pushNotification(formatMessage(msg.resetUserPasswordSuccess, { name }));
        })
        .catch(() => {
          pushNotification(formatMessage(msg.resetUserPasswordError, { name }));
        }),
    changePolicy: ({ pushNotification, intl: { formatMessage } }) => () => {
      pushNotification(formatMessage(msg.changePolicy));
    },
  }),
  withProps((props) => ({
    memberActions: {
      disable: props.disableMember,
      enable: props.enableMember,
      resetPassword: props.resetMemberPassword,
    },
  })),
  setDisplayName('Admin'),
)(({
  addMember,
  members,
  memberActions,
  getMemberAudit,
  memberAudit,
  packages,
  packageActions,
  getPackageAudit,
  packageAudit,
  intl: { formatMessage },
  changePolicy,
}) => (
  <div>
    <h1>{formatMessage(msg.teamHeader, { name: teamName })}</h1>

    <Policies
      read
      write={false}
      onReadCheck={changePolicy}
      onWriteCheck={changePolicy}
    />

    <AddMember addMember={addMember} />

    <Members {...members} audit={getMemberAudit} actions={memberActions} />

    <Packages {...packages} audit={getPackageAudit} actions={packageActions} />

    <AuditDialog
      onClose={() => getMemberAudit(null)}
      title={`${formatMessage(msg.auditUser)}: ${memberAudit.name}`}
      component={MemberAudit}
      {...memberAudit}
    />

    <AuditDialog
      onClose={() => getPackageAudit(null)}
      title={`${formatMessage(msg.auditPackage)}: ${packageAudit.handle}`}
      component={PackageAudit}
      {...packageAudit}
    />
  </div>
));
