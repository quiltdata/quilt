/* Admin messages */
import { defineMessages } from 'react-intl';

export default defineMessages({
  membersAdd: {
    id: 'app.containers.Admin.membersAdd',
    defaultMessage: 'Add member',
  },
  membersRead: {
    id: 'app.containers.Admin.membersRead',
    defaultMessage: 'Members can read public packages',
  },
  membersWrite: {
    id: 'app.containers.Admin.membersWrite',
    defaultMessage: 'Members can write public packages',
  },
  teamHeader: {
    id: 'app.containers.Admin.teamHeader',
    defaultMessage: 'Team {name}',
  },
  teamMembers: {
    id: 'app.containers.Admin.teamMembers',
    defaultMessage: 'Members',
  },
  teamPackages: {
    id: 'app.containers.Admin.teamMembers',
    defaultMessage: 'Packages',
  },
  teamPolicies: {
    id: 'app.containers.Admin.teamPolicies',
    defaultMessage: 'Policies',
  },
  auditUser: {
    id: 'app.containers.Admin.auditUser',
    defaultMessage: 'Audit user',
  },
  auditPackage: {
    id: 'app.containers.Admin.auditPackage',
    defaultMessage: 'Audit package',
  },
  removeUserSuccess: {
    id: 'app.containers.Admin.removeUserSuccess',
    defaultMessage: 'User {name} has been removed',
  },
  removeUserError: {
    id: 'app.containers.Admin.removeUserError',
    defaultMessage: 'There was an error while removing user {name}',
  },
  resetUserPasswordSuccess: {
    id: 'app.containers.Admin.resetUserPasswordSuccess',
    defaultMessage: 'Password for user {name} has been reset',
  },
  resetUserPasswordError: {
    id: 'app.containers.Admin.resetUserPasswordError',
    defaultMessage: 'There was an error while resetting password for user {name}',
  },
  defaultErrorMessage: {
    id: 'app.containers.Admin.defaultErrorMessage',
    defaultMessage: 'Something went wrong',
  },
  closeAuditDialog: {
    id: 'app.containers.Admin.closeAuditDialog',
    defaultMessage: 'Close',
  },
  addMemberFormErrorUniq: {
    id: 'app.containers.Admin.AddMember.formErrorUniq',
    defaultMessage: 'The user with this username or email already exists',
  },
  addMemberFormErrorUsername: {
    id: 'app.containers.Admin.AddMember.formErrorUsername',
    defaultMessage: 'Username must start with a letter or underscore, and contain only alphanumeric characters and underscores thereafter',
  },
  addMemberUsername: {
    id: 'app.containers.Admin.AddMember.username',
    defaultMessage: 'Username',
  },
  addMemberUsernameRequired: {
    id: 'app.containers.Admin.AddMember.usernameRequired',
    defaultMessage: 'Enter a username please',
  },
  addMemberUsernameInvalid: {
    id: 'app.containers.Admin.AddMember.usernameInvalid',
    defaultMessage: 'Enter a valid username please',
  },
  addMemberEmail: {
    id: 'app.containers.Admin.AddMember.email',
    defaultMessage: 'Email',
  },
  addMemberEmailRequired: {
    id: 'app.containers.Admin.AddMember.emailRequired',
    defaultMessage: 'Enter an email please',
  },
  addMemberEmailInvalid: {
    id: 'app.containers.Admin.AddMember.emailInvalid',
    defaultMessage: 'Enter a valid email please',
  },
  addMemberSubmit: {
    id: 'app.containers.Admin.AddMember.submit',
    defaultMessage: 'Add',
  },
  addMemberSuccess: {
    id: 'app.containers.Admin.AddMember.success',
    defaultMessage: 'User {name} <{email}> added successfully',
  },
  pkgHandle: {
    id: 'app.containers.Admin.Packages.handle',
    defaultMessage: 'Handle',
  },
  pkgActivity: {
    id: 'app.containers.Admin.Packages.activity',
    defaultMessage: 'Activity',
  },
  pkgLastModified: {
    id: 'app.containers.Admin.Packages.lastModified',
    defaultMessage: 'Last modified',
  },
  pkgEmpty: {
    id: 'app.containers.Admin.Packages.empty',
    defaultMessage: 'Nothing here yet',
  },
  membersName: {
    id: 'app.containers.Admin.Members.name',
    defaultMessage: 'Name',
  },
  membersActivity: {
    id: 'app.containers.Admin.Members.activity',
    defaultMessage: 'Activity',
  },
  membersLastSeen: {
    id: 'app.containers.Admin.Members.lastSeen',
    defaultMessage: 'Last seen',
  },
  membersSettings: {
    id: 'app.containers.Admin.Members.settings',
    defaultMessage: 'Settings',
  },
  membersEmpty: {
    id: 'app.containers.Admin.Members.empty',
    defaultMessage: 'Noone here yet',
  },
  membersRemove: {
    id: 'app.containers.Admin.Members.remove',
    defaultMessage: 'Remove member',
  },
  membersResetPassword: {
    id: 'app.containers.Admin.Members.resetPassword',
    defaultMessage: 'Reset password',
  },
  pkgAuditTime: {
    id: 'app.containers.Admin.PackageAudit.time',
    defaultMessage: 'Time',
  },
  pkgAuditUser: {
    id: 'app.containers.Admin.PackageAudit.user',
    defaultMessage: 'User',
  },
  pkgAuditEvent: {
    id: 'app.containers.Admin.PackageAudit.event',
    defaultMessage: 'Event',
  },
  pkgAuditEmpty: {
    id: 'app.containers.Admin.PackageAudit.empty',
    defaultMessage: 'Nothing here yet',
  },
  memberAuditTime: {
    id: 'app.containers.Admin.MemberAudit.time',
    defaultMessage: 'Time',
  },
  memberAuditPackage: {
    id: 'app.containers.Admin.MemberAudit.package',
    defaultMessage: 'Package',
  },
  memberAuditEvent: {
    id: 'app.containers.Admin.MemberAudit.event',
    defaultMessage: 'Event',
  },
  memberAuditEmpty: {
    id: 'app.containers.Admin.MemberAudit.empty',
    defaultMessage: 'Nothing here yet',
  },
});
