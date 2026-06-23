/* ImageLightbox — fullscreen image viewer for message attachments.
 *
 * Webapp uses a portal-mounted lightbox; on native we render a full-
 * screen Modal with the image centered and resized to contain (so the
 * full image is always visible without cropping). Tap or back closes.
 *
 * Limited scope: no pinch-to-zoom in v1 — adding that needs
 * react-native-gesture-handler + reanimated which aren't installed
 * yet. Tap-to-close is the dismissal path. */

import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CLIcon } from '../../../../reusables/design/primitives';

interface Props {
  uri: string | null;
  onClose: () => void;
}

export default function ImageLightbox({ uri, onClose }: Props) {
  if (!uri) return null;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable style={styles.tapZone} onPress={onClose}>
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </Pressable>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <CLIcon n="close" size={22} color="#fff" />
          </Pressable>
        </SafeAreaView>
        {/* Subtle hint so first-time users know taps dismiss. */}
        <View pointerEvents="none" style={styles.hintWrap}>
          <View
            style={[styles.hint, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          >
            <CLIcon n="touch-app" size={14} color="#fff" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  tapZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  headerSafe: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    alignItems: 'flex-end',
    paddingHorizontal: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  hintWrap: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
