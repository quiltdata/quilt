import { defineMessages } from 'react-intl';

const scope = 'app.containers.Admin.Packages';

export default defineMessages({
  heading: {
    id: `${scope}.heading`,
    defaultMessage: 'Packages',
  },
  handle: {
    id: `${scope}.handle`,
    defaultMessage: 'Handle',
  },
  activity: {
    id: `${scope}.activity`,
    defaultMessage: 'Activity',
  },
  lastModified: {
    id: `${scope}.lastModified`,
    defaultMessage: 'Last modified',
  },
  empty: {
    id: `${scope}.empty`,
    defaultMessage: 'Nothing here yet',
  },
  deleted: {
    id: `${scope}.deleted`,
    defaultMessage: 'deleted',
  },
});
