/* Per-user settings persistence — RN-side analogue of the webapp's
 * localforagehelper.ts (which is backed by IndexedDB).
 *
 * AsyncStorage keys are namespaced `usersettings:<userID>` so multiple
 * accounts on the same device keep their own settings. Reads return the
 * full settings object so consumers can merge it into redux on app
 * start. */

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  IUserSettings,
} from "../vars/interfaces";
import { usersettingsstate } from "../../redux/actions/states";

function keyFor(userID: string) {
  return `usersettings:${userID}`;
}

export async function loadUserSettings(userID: string): Promise<IUserSettings> {
  if (!userID) return usersettingsstate;
  try {
    const raw = await AsyncStorage.getItem(keyFor(userID));
    if (!raw) return usersettingsstate;
    const parsed = JSON.parse(raw) as Partial<IUserSettings>;
    // Merge with defaults so any settings added since last save are filled in.
    return {
      ...usersettingsstate,
      ...parsed,
      map_feed_access: {
        ...usersettingsstate.map_feed_access,
        ...(parsed.map_feed_access ?? {}),
      },
      messages: {
        ...usersettingsstate.messages,
        ...(parsed.messages ?? {}),
      },
    };
  } catch (err) {
    console.log("[loadUserSettings]", err);
    return usersettingsstate;
  }
}

export async function persistUserSettings(
  userID: string,
  settings: IUserSettings,
): Promise<void> {
  if (!userID) return;
  try {
    await AsyncStorage.setItem(keyFor(userID), JSON.stringify(settings));
  } catch (err) {
    console.log("[persistUserSettings]", err);
  }
}
