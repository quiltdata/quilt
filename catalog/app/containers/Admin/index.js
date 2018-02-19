/* Admin */
import Checkbox from 'material-ui/Checkbox';
import PT from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { FormattedMessage } from 'react-intl';
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
import messages from './messages';
import selector from './selectors';
import AddMember from './AddMember';
import Members from './Members';
import MemberAudit from './MemberAudit';
import Packages from './Packages';
import PackageAudit from './PackageAudit';


const teamName = config.team && config.team.name;

const dispatchPromise = (actionCreator, ...args) =>
  new Promise((resolve, reject) => actionCreator(...args, { resolve, reject }));

export default compose(
  connect(selector, { pushNotification: push, ...actions }),
  setPropTypes({
    addMember: PT.func.isRequired,
    members: PT.object.isRequired,
    getMembers: PT.func.isRequired,
    memberAudit: PT.object.isRequired,
    getMemberAudit: PT.func.isRequired,
    removeMember: PT.func.isRequired,
    resetMemberPassword: PT.func.isRequired,
    packages: PT.object.isRequired,
    getPackages: PT.func.isRequired,
    packageAudit: PT.object.isRequired,
    getPackageAudit: PT.func.isRequired,
    removePackage: PT.func.isRequired,
    pushNotification: PT.func.isRequired,
  }),
  lifecycle({
    componentWillMount() {
      this.props.getMembers();
      this.props.getPackages();
    },
  }),
  withHandlers({
    removeMember: ({ removeMember, pushNotification }) => (name) => {
      if (!confirm(`Are you sure you want to delete user ${name}?`)) {
        return Promise.resolve();
      }

      return dispatchPromise(removeMember, name)
        .then(() => {
          pushNotification(`User ${name} has been removed`);
        })
        .catch(() => {
          pushNotification(`There was an error while removing ${name}`);
        });
    },
    resetMemberPassword: ({ resetMemberPassword, pushNotification }) => (name) =>
      dispatchPromise(resetMemberPassword, name)
        .then(() => {
          pushNotification(`Password for user ${name} has been reset`);
        })
        .catch(() => {
          pushNotification(`There was an error while resetting password for ${name}`);
        }),
    removePackage: ({ removePackage, pushNotification }) => (handle) => {
      if (!confirm(`Are you sure you want to delete package ${handle}?`)) {
        return Promise.resolve();
      }

      return dispatchPromise(removePackage, handle)
        .then(() => {
          pushNotification(`Package ${handle} has been deleted`);
        })
        .catch(() => {
          pushNotification(`There was an error while deleting package ${handle}`);
        });
    },
  }),
  withProps(({ removeMember, resetMemberPassword, removePackage }) => ({
    memberActions: {
      remove: removeMember,
      resetPassword: resetMemberPassword,
    },
    packageActions: {
      remove: removePackage,
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
}) => (
  <div>
    <h1><FormattedMessage {...messages.teamHeader} values={{ name: teamName.toUpperCase() }} /></h1>

    <h2><FormattedMessage {...messages.teamPolicies} /></h2>
    <Checkbox checked label={<FormattedMessage {...messages.membersRead} />} />
    <Checkbox checked={false} label={<FormattedMessage {...messages.membersWrite} />} />

    <AddMember addMember={addMember} />

    <Members {...members} audit={getMemberAudit} actions={memberActions} />

    <Packages {...packages} audit={getPackageAudit} actions={packageActions} />

    <MemberAudit
      onClose={() => getMemberAudit(null)}
      {...memberAudit}
    />

    <PackageAudit
      onClose={() => getPackageAudit(null)}
      {...packageAudit}
    />
  </div>
));
