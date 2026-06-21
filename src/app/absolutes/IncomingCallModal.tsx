/* eslint-disable react-native/no-inline-styles */
/* IncomingCallModal — system-level overlay for inbound calls.
 *
 * Subscribes to the `alerts` slice and surfaces a full-screen sheet
 * whenever an alert of type 'incomingcall' lands. SSE (sse.ts) already
 * dispatches that alert plus a `pendingcallalerts` entry the moment the
 * backend pushes `incomingcall`. The bell sound is played on the SSE
 * side too — this component is pure UI.
 *
 * Accept path:
 *   - Drops the alert + the pending-call entry.
 *   - Surfaces an info alert that the active call UI ships in the
 *     next cycle (MediaSoup transport isn't wired yet on RN).
 *
 * Decline path:
 *   - Drops the alert + the pending-call entry.
 *   - Fires RejectCallRequest so the caller's modal dismisses too. */

import React, { useCallback, useEffect, useMemo } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import type { AppState } from '../../redux/store';
import type { Alert, CallMetadata } from '../../redux/reducers';
import {
  REMOVE_PENDING_CALL_ALERTS,
  SET_ALERTS,
  SET_FILTERED_ALERTS,
} from '../../redux/types';
import { useTheme } from '../../reusables/design/ThemeProvider';
import { CLIcon } from '../../reusables/design/primitives';
import { radii } from '../../reusables/design/tokens';
import { RejectCallRequest } from '../../reusables/hooks/requests';

function callerName(meta: CallMetadata): string {
  const fn = meta.caller?.firstName ?? '';
  const ln = meta.caller?.lastName ?? '';
  return `${fn} ${ln}`.trim() || 'Incoming call';
}

function callerInitial(meta: CallMetadata): string {
  return (meta.caller?.firstName ?? '?').charAt(0).toUpperCase();
}

export default function IncomingCallModal() {
  const { palette } = useTheme();
  const dispatch = useDispatch();
  const alerts = useSelector((s: AppState) => s.alerts as Alert[]);

  // First incomingcall wins. If the user gets a second one while a
  // first is still on-screen, it queues behind — when this one is
  // accepted/declined the next renders.
  const active = useMemo(
    () => alerts.find(a => a.type === 'incomingcall' && a.callmetadata),
    [alerts],
  );

  const dismiss = useCallback(
    (a: Alert) => {
      dispatch({ type: SET_FILTERED_ALERTS, payload: { alertID: a.id } });
      if (a.callmetadata?.conversationID) {
        dispatch({
          type: REMOVE_PENDING_CALL_ALERTS,
          payload: { callID: a.callmetadata.conversationID },
        });
      }
    },
    [dispatch],
  );

  // Auto-dismiss after 60s of inactivity. Mirrors webapp Alert.tsx so
  // an abandoned ring (caller cancels mid-call before the backend
  // pushes a `callreject`) doesn't trap the user behind the modal.
  // The timer resets whenever a new incoming alert replaces the
  // active one (different alert.id) so back-to-back calls each get
  // their own 60s window.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => dismiss(active), 60_000);
    return () => clearTimeout(t);
  }, [active, dismiss]);

  const onDecline = useCallback(() => {
    if (!active?.callmetadata) return;
    const meta = active.callmetadata;
    dismiss(active);
    RejectCallRequest({
      conversationType: meta.conversationType,
      conversationID: meta.conversationID,
      caller: meta.caller,
    });
  }, [active, dismiss]);

  const onAccept = useCallback(() => {
    if (!active) return;
    dismiss(active);
    // Active call UI lands in the next cycle (needs react-native-webrtc
    // + mediasoup-client). For now, tell the user.
    dispatch({
      type: SET_ALERTS,
      payload: {
        alerts: {
          id: alerts.length,
          type: 'info',
          content:
            'Call accepted. Live audio/video will land in the next update.',
        },
      },
    });
  }, [active, alerts.length, dispatch, dismiss]);

  if (!active?.callmetadata) return null;
  const meta = active.callmetadata;
  const isVideo = meta.callType === 'video';
  const profile =
    meta.caller?.profile && meta.caller.profile !== 'none'
      ? (meta.caller.profile as string)
      : null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onDecline}
      statusBarTranslucent
    >
      <View style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}
        >
          <Text style={[styles.kicker, { color: palette.text3 }]}>
            INCOMING · {isVideo ? 'VIDEO' : 'AUDIO'}
          </Text>
          {profile ? (
            <Image source={{ uri: profile }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                { backgroundColor: palette.brandSoft },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: palette.brand }]}>
                {callerInitial(meta)}
              </Text>
            </View>
          )}
          <Text style={[styles.name, { color: palette.text }]}>
            {callerName(meta)}
          </Text>
          <Text style={[styles.sub, { color: palette.text3 }]}>
            {active.content || 'is calling…'}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onDecline}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: palette.pink,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <CLIcon n="call-end" size={26} color="#fff" />
              <Text style={styles.actionLabel}>Decline</Text>
            </Pressable>
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: palette.green,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <CLIcon n="call" size={26} color="#fff" />
              <Text style={styles.actionLabel}>Accept</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    marginTop: 6,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginTop: 8 },
  sub: { fontSize: 13, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 18,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
