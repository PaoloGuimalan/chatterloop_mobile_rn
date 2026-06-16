/* Map Feed — TODO: port webapp/src/app/tabs/mapfeed/MapFeed.tsx.
 * Webapp uses maplibre + a custom socket for live coordinate broadcast.
 * On RN, react-native-maps (Google/Apple) or @rnmapbox/maps work; the
 * broadcast logic in webapp/src/reusables/hooks/mapsocket.ts is portable
 * almost as-is. */

import React from "react";
import TabStub from "../_TabStub";

export default function MapFeed() {
  return (
    <TabStub
      title="Map Feed"
      icon="map"
      source="webapp/src/app/tabs/mapfeed/MapFeed.tsx"
      notes="Add react-native-maps (or @rnmapbox/maps), port socketMapConnect/socketSendCoordinatesBroadcast from webapp/src/reusables/hooks/mapsocket.ts, request foreground/background location permissions."
    />
  );
}
