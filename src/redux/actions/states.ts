/* Initial slice states — mirrors webapp/src/redux/actions/states.ts.
 * Some web-only fields (screensizelistener uses window.innerWidth) are
 * adapted for RN (Dimensions). */

import { Dimensions } from "react-native";
import {
  AuthenticationInterface,
  IContact,
  IUserSettings,
  PaginationProp,
} from "../../reusables/vars/interfaces";

export const authenticationstate: AuthenticationInterface = {
  auth: null,
  user: {
    id: "",
    username: "",
    profile: "",
    coverphoto: "",
    userID: "",
    fullName: { firstName: "", middleName: "", lastName: "" },
    birthdate: null,
    gender: null,
    email: "",
    isActivated: null,
    isVerified: null,
    isComplete: false,
  },
};

export const conversationsetupstate = {
  conversationid: null as string | null,
  userdetails: {
    userID: "",
    fullname: { firstName: "", middleName: "", lastName: "" },
    profile: "",
  },
  groupdetails: {
    groupName: "",
    receivers: [] as unknown[],
    profile: "",
  },
  type: "",
};

const dims = Dimensions.get("window");
export const screensizelistenerstate = { W: dims.width, H: dims.height };

export const contactsliststate: PaginationProp<IContact> = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

export const usersettingsstate: IUserSettings = {
  personal_info: null,
  map_feed_access: {
    enable_location: false,
    share_location: false,
    current_mode: 0,
    toggleSpeed: false,
  },
  messages: { type: "common" },
};
