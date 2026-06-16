/* Shared interfaces — narrow port of webapp/src/reusables/vars/interfaces.ts.
 * Only what the auth + tab scaffolding consumes today is included; expand
 * as you migrate more features. */

export interface FullName {
  firstName: string;
  middleName: string | null;
  lastName: string;
}

export interface AuthUser {
  id: string;
  userID: string;
  username: string;
  profile: string;
  coverphoto: string;
  fullName: FullName;
  birthdate: { month: string; day: string; year: string } | null;
  gender: string | null;
  email: string;
  isActivated: boolean | null;
  isVerified: boolean | null;
  isComplete: boolean;
}

export interface AuthenticationInterface {
  auth: boolean | null;
  user: AuthUser;
}

export interface IUserSettings {
  personal_info: unknown;
  map_feed_access: {
    enable_location: boolean;
    share_location: boolean;
    current_mode: number;
    toggleSpeed: boolean;
  };
  messages: { type: string };
}

export interface PaginationProp<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface IContact {
  connection_id: string;
  type: "single" | "group";
  action_by: {
    id: string;
    username: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    profile: string;
    is_badged?: boolean;
  };
  involved_user: {
    id: string;
    username: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    profile: string;
    is_badged?: boolean;
  };
}
