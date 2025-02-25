import * as sessions from "./sessions.schema";
import * as users from "./users.schema";
import * as userProviders from "./user-provider.schema";

export default {
  ...sessions,
  ...users,
  ...userProviders,
};
