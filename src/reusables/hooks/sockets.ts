/* Call signaling socket — mirrors webapp/src/reusables/hooks/sockets.ts.
 *
 * socket.io-client works identically in React Native (long-poll falls
 * back to WebSocket which RN supports natively). API kept verbatim so
 * the eventual MediaSoup call UI port can copy/paste from webapp. */

import { io, Socket } from "socket.io-client";
import envs from "./env_configs";

const API = envs.CHATTERLOOP_API;

let socket: Socket | null = null;

const socketInit = async () => {
  if (!socket) {
    socket = io(`${API}/call`);
  }
  return true;
};

const socketConversationInit = async (
  data: any,
  initcaller: (data: any) => void,
  resolve: (data: any) => void,
  newcaller: (data: any) => void,
  answerreponse: (data: any) => void,
  addnewicecandidate: (data: any) => void,
) => {
  if (!socket) return;
  socket.emit("init", data);
  socket.on("caller_connected", initcaller);
  socket.on("newOfferAwaiting", resolve);
  socket.on("newCaller", newcaller);
  socket.on("answerResponse", answerreponse);
  socket.on("receivedIceCandidateFromServer", addnewicecandidate);
};

const socketCloseCall = async (data: any) => {
  if (!socket) return false;
  socket.emit("leavecall", data);
  return true;
};

const socketSendNewOffer = async (data: any) => {
  if (!socket) return false;
  socket.emit("newOffer", data);
  return true;
};

const socketEmitNewAnswer = async (data: any) => {
  if (!socket) return undefined;
  return await socket.emitWithAck("newAnswer", data);
};

const socketSendData = async (data: any) => {
  if (socket) socket.emit("data", data);
};

const socketSendAnswerData = async (data: any) => {
  if (socket) socket.emit("answer_data", data);
};

const socketSendNegotiationData = async (data: any) => {
  if (socket) socket.emit("answer_negotiation_data", data);
};

const socketFinishNegotiationData = async (data: any) => {
  if (socket) socket.emit("finish_negotiation_data", data);
};

const socketSendIceCandidate = async (data: any) => {
  if (socket) socket.emit("sendIceCandidateToSignalingServer", data);
};

const endSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export {
  socket,
  socketInit,
  socketConversationInit,
  socketSendNewOffer,
  socketSendData,
  socketSendAnswerData,
  socketSendNegotiationData,
  socketFinishNegotiationData,
  socketSendIceCandidate,
  socketEmitNewAnswer,
  socketCloseCall,
  endSocket,
};
