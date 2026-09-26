import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/common/motion';
import { AppIcon, AppText } from '@/components/common/ui';
import { colors, radii, shadow } from '@/constants/theme';
import type { Wallet } from '@/features/finance/types';
import { walletAccent, walletTypeMeta } from '@/features/finance/wallet-presentation';
import { formatPeso } from '@/lib/format';

/** Payment-card proportions, so a row of tiles reads as a wallet at a glance. */
const CARD_RATIO = 1.62;
/** Mask shown wherever a balance is hidden, so every blanked figure matches. */
export const HIDDEN_AMOUNT = '••••••';

type Props = {
  wallet: Wallet;
  index?: number;
  hidden?: boolean;
  /** Overrides the ••• button label when it does something other than manage. */
  moreLabel?: string;
  onPress?: () => void;
  onMore?: () => void;
};

/**
 * The card face shared by every surface that shows a wallet. Keeping it in one
 * component is what stops the wallet tab and the manage screen from drifting
 * into two different looks.
 */
export function WalletCardFace({ wallet, index = 0, hidden = false, moreLabel, onPress, onMore }: Props) {
  const accent = walletAccent(wallet.color, index);
  const meta = walletTypeMeta(wallet.type);
  const balance = hidden ? HIDDEN_AMOUNT : formatPeso(wallet.balanceCents, { alwaysShowDecimals: true });

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${wallet.name} wallet, ${balance}`}
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.card, { backgroundColor: accent }]}
    >
      {/* Two soft discs and a faint type mark give the flat colour depth; all
          three are background, never content. */}
      <View pointerEvents="none" style={styles.glowLarge} />
      <View pointerEvents="none" style={styles.glowSmall} />
      <View pointerEvents="none" style={styles.watermark}>
        <AppIcon name={meta.icon} size={64} color="rgba(255,255,255,.12)" />
      </View>

      <View style={styles.top}>
        <View style={styles.identity}>
          <AppIcon name={meta.icon} size={17} color={colors.white} />
          <AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.name}>{wallet.name}</AppText>
        </View>
        {onMore ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={moreLabel ?? `Manage ${wallet.name}`}
            hitSlop={8}
            onPress={onMore}
            style={styles.more}
          >
            <AppIcon name="dots-horizontal" size={16} color={colors.white} />
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <AppText style={styles.caption}>BALANCE</AppText>
        <View style={styles.balanceRow}>
          <AppText
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            style={styles.balance}
          >
            {balance}
          </AppText>
          {wallet.isDefault ? <View style={styles.defaultDot} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

/** Dashed twin of the card face, sized identically so the grid stays even. */
export function AddWalletCard({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Add a wallet"
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.card, styles.addCard]}
    >
      <AppIcon name="plus" size={26} color={colors.forest} />
      <AppText variant="small" style={styles.addLabel}>Add wallet</AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: CARD_RATIO,
    borderRadius: radii.md,
    padding: 13,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadow,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C6D3C1',
    backgroundColor: 'rgba(255,253,247,.72)',
    shadowOpacity: 0,
    elevation: 0,
  },
  addLabel: { color: colors.forest, fontFamily: 'JakartaSemiBold' },
  glowLarge: {
    position: 'absolute',
    right: -54,
    top: -66,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(255,255,255,.10)',
  },
  glowSmall: {
    position: 'absolute',
    right: -22,
    bottom: -46,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,.07)',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    flexShrink: 1,
    color: colors.white,
    fontFamily: 'JakartaBold',
    fontSize: 14,
    lineHeight: 19,
  },
  more: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,.18)',
  },
  watermark: {
    position: 'absolute',
    right: 8,
    top: '26%',
    transform: [{ rotate: '-12deg' }],
  },
  bottom: { gap: 1 },
  caption: {
    color: 'rgba(255,255,255,.72)',
    fontFamily: 'JakartaSemiBold',
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 1.1,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balance: {
    flexShrink: 1,
    color: colors.white,
    fontFamily: 'JakartaExtraBold',
    fontSize: 19,
    lineHeight: 24,
  },
  defaultDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,.85)',
  },
});
