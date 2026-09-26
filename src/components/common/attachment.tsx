import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/common/motion';
import { Skeleton } from '@/components/common/skeleton';
import { AppIcon, AppText } from '@/components/common/ui';
import { colors, radii } from '@/constants/theme';
import { attachmentUrl } from '@/features/expenses/attachment-service';

export type PickedPhoto = { uri: string; width: number; height: number };

/** Full-screen view of a receipt or attached photo. */
export function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={Boolean(uri)} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        {uri ? <Image source={{ uri }} contentFit="contain" style={styles.viewerImage} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo" hitSlop={10} onPress={onClose} style={[styles.viewerClose, { top: insets.top + 12 }]}>
          <AppIcon name="close" size={24} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

async function pick(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  const asset = result.assets?.[0];
  return !result.canceled && asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

/** Optional photo on a form: add from camera or gallery, preview, remove. */
export function AttachmentField({ photo, onChange }: { photo: PickedPhoto | null; onChange: (photo: PickedPhoto | null) => void }) {
  const [viewing, setViewing] = useState(false);
  const choose = async (source: 'camera' | 'library') => { const next = await pick(source); if (next) onChange(next); };
  return (
    <View style={styles.field}>
      <AppText variant="bodyMedium" style={styles.label}>Photo (optional)</AppText>
      {photo ? (
        <View style={styles.attached}>
          <PressableScale accessibilityRole="button" accessibilityLabel="View attached photo" onPress={() => setViewing(true)} style={styles.thumb}>
            <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.fill} />
          </PressableScale>
          <View style={styles.attachedCopy}>
            <AppText variant="bodyMedium">Photo attached</AppText>
            <AppText variant="small" style={styles.muted}>Tap it to view. Kept with this expense for reference.</AppText>
          </View>
          <PressableScale accessibilityRole="button" accessibilityLabel="Remove photo" hitSlop={6} onPress={() => onChange(null)} style={styles.remove}>
            <AppIcon name="close" size={18} color={colors.deepForest} />
          </PressableScale>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <PressableScale accessibilityRole="button" onPress={() => void choose('camera')} style={styles.pickButton}>
            <AppIcon name="camera-outline" size={20} color={colors.forest} />
            <AppText variant="bodyMedium" style={styles.pickText}>Take Photo</AppText>
          </PressableScale>
          <PressableScale accessibilityRole="button" onPress={() => void choose('library')} style={styles.pickButton}>
            <AppIcon name="image-outline" size={20} color={colors.forest} />
            <AppText variant="bodyMedium" style={styles.pickText}>Choose Photo</AppText>
          </PressableScale>
        </View>
      )}
      <PhotoViewer uri={viewing && photo ? photo.uri : null} onClose={() => setViewing(false)} />
    </View>
  );
}

/** A saved transaction's photo, loaded through a short-lived private link. */
export function StoredAttachment({ path, label = 'Receipt photo' }: { path: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState(false);
  useEffect(() => {
    let active = true;
    void attachmentUrl(path).then((next) => { if (!active) return; if (next) setUrl(next); else setFailed(true); });
    return () => { active = false; };
  }, [path]);
  return (
    <>
      <PressableScale accessibilityRole="button" accessibilityLabel={`View ${label.toLowerCase()}`} disabled={!url} onPress={() => setViewing(true)} style={styles.stored}>
        <View style={styles.storedThumb}>{url ? <Image source={{ uri: url }} contentFit="cover" style={styles.fill} /> : failed ? <AppIcon name="image-off-outline" size={24} color={colors.muted} /> : <Skeleton height={64} radius={radii.sm} />}</View>
        <View style={styles.attachedCopy}>
          <AppText variant="bodyMedium">{label}</AppText>
          <AppText variant="small" style={styles.muted}>{failed ? 'Connect to the internet to view it.' : 'Tap to view full screen.'}</AppText>
        </View>
        <AppIcon name="chevron-right" size={22} color={colors.muted} />
      </PressableScale>
      <PhotoViewer uri={viewing ? url : null} onClose={() => setViewing(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  fill: { width: '100%', height: '100%' },
  field: { gap: 7 },
  label: { marginLeft: 2 },
  pickRow: { flexDirection: 'row', gap: 10 },
  pickButton: { flex: 1, minHeight: 52, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.lightGreen, backgroundColor: 'rgba(232,238,227,.6)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pickText: { color: colors.forest },
  attached: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.md, backgroundColor: 'rgba(232,238,227,.9)', borderWidth: 1, borderColor: '#C9D5C5' },
  attachedCopy: { flex: 1, minWidth: 0, gap: 2 },
  thumb: { width: 56, height: 56, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.pale },
  remove: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stored: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storedThumb: { width: 64, height: 64, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.pale, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,.94)', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '86%' },
  viewerClose: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.18)' },
});
