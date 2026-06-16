/* Live coordinates broadcast socket — mirrors webapp/src/reusables/hooks/mapsocket.ts.
 *
 * Connects to the `/map` namespace and emits coordinate updates as the
 * device location changes. Kept as a separate file (not folded into
 * sockets.ts) so the `socket` module-local isn't shared across
 * namespaces. */

import { io, Socket } from "socket.io-client";
import envs from "./env_configs";

const API = envs.CHATTERLOOP_API;

let socket: Socket | null = null;

const socketMapConnect = async () => {
  if (!socket) {
    socket = io(`${API}/map`);
  }
  return true;
};

const socketMapInit = async (data: { id: string; userID: string }) => {
  if (socket) socket.emit("init", data);
};

const socketSendCoordinatesBroadcast = async (data: any) => {
  if (socket) {
    socket.emit("coordinatesbroadcast", data);
    return;
  }
  console.log("No active sockets");
};

const endMapSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export {
  socket,
  socketMapInit,
  socketMapConnect,
  socketSendCoordinatesBroadcast,
  endMapSocket,
};
