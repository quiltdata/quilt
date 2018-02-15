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
  withProps,
} from 'recompose';

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

export default compose(
  connect(selector, actions),
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
  }),
  lifecycle({
    componentWillMount() {
      this.props.getMembers();
      this.props.getPackages();
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
