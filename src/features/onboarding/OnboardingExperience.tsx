import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  type ImageStyle,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, AppText, BackButton, Brand, Card, PrimaryButton, SecondaryButton } from '@/components/common/ui';
import { assets, colors, radii } from '@/constants/theme';

type OnboardingPageData = {
  id: string;
  title: string;
  description: string;
  mascot: ImageSource;
  summary: {
    icon: Parameters<typeof AppIcon>[0]['name'];
    title: string;
    description: string;
  };
};

const pages: OnboardingPageData[] = [
  {
    id: 'scan',
    title: 'Track smarter, not harder.',
    description: 'Turn receipts into verified expense records and understand your spending with less effort.',
    mascot: assets.mascotNeutral,
    summary: {
      icon: 'receipt-text-check-outline',
      title: 'Scan. Verify. Understand.',
      description: 'Turn your receipts into verified transactions and clear insights.',
    },
  },
  {
    id: 'verify',
    title: 'Review details with confidence.',
    description: 'Confirm important information before it becomes part of your spending history.',
    mascot: assets.mascotScanning,
    summary: {
      icon: 'shield-check-outline',
      title: 'Review before saving.',
      description: 'Check totals, dates, merchants, and extracted details first.',
    },
  },
  {
    id: 'insights',
    title: 'See where your money goes.',
    description: 'Turn verified transactions into a clearer view of your everyday spending.',
    mascot: assets.mascotTip,
    summary: {
      icon: 'chart-donut',
      title: 'Understand your spending.',
      description: 'See useful categories, trends, and insights from verified expenses.',
    },
  },
];

const PAGE_COUNT = pages.length;
const SWIPE_VELOCITY_THRESHOLD = 350;
const SWIPE_DISTANCE_RATIO = 0.22;
const SNAP_DURATION = 280;
const SHELL_MAX_WIDTH = 430;
const HEADER_HEIGHT = 64;
// First-frame estimate only; onLayout replaces it with the measured value.
// Tracks the controls' padding so the hero doesn't jump on mount.
const ESTIMATED_CONTROLS_HEIGHT = 206;

const snapEasing = Easing.out(Easing.cubic);

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

export default function OnboardingExperience() {
  const windowSize = useWindowDimensions();
  const initialViewportWidth = Math.min(windowSize.width, SHELL_MAX_WIDTH);
  const initialViewportHeight = Math.max(
    windowSize.height - HEADER_HEIGHT - ESTIMATED_CONTROLS_HEIGHT,
    1,
  );
  const [viewport, setViewport] = useState({
    width: initialViewportWidth,
    height: initialViewportHeight,
  });
  const reducedMotion = Boolean(useReducedMotion());

  const translateX = useSharedValue(0);
  const currentIndex = useSharedValue(0);
  const viewportWidth = useSharedValue(initialViewportWidth);

  const onViewportLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;

    setViewport((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
    viewportWidth.value = width;
    translateX.value = -currentIndex.value * width;
  };

  const goToPage = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, PAGE_COUNT - 1));
    currentIndex.value = clampedIndex;
    const destination = -clampedIndex * viewportWidth.value;
    translateX.value = reducedMotion
      ? destination
      : withTiming(destination, { duration: SNAP_DURATION, easing: snapEasing });
  };

  const panGesture = Gesture.Pan()
    .enabled(viewport.width > 0)
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      'worklet';
      const width = viewportWidth.value;
      const proposed = -currentIndex.value * width + event.translationX;
      const minimum = -(PAGE_COUNT - 1) * width;

      translateX.value = Math.max(minimum, Math.min(0, proposed));
    })
    .onEnd((event) => {
      'worklet';
      const width = viewportWidth.value;
      const swipedFar = Math.abs(event.translationX) > width * SWIPE_DISTANCE_RATIO;
      const swipedFast = Math.abs(event.velocityX) > SWIPE_VELOCITY_THRESHOLD;
      let nextIndex = currentIndex.value;

      if ((swipedFar || swipedFast) && event.translationX < 0) {
        nextIndex = Math.min(PAGE_COUNT - 1, currentIndex.value + 1);
      } else if ((swipedFar || swipedFast) && event.translationX > 0) {
        nextIndex = Math.max(0, currentIndex.value - 1);
      }

      currentIndex.value = nextIndex;
      translateX.value = withTiming(-nextIndex * width, {
        duration: SNAP_DURATION,
        easing: snapEasing,
      });
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success) {
        translateX.value = withTiming(-currentIndex.value * viewportWidth.value, {
          duration: SNAP_DURATION,
          easing: snapEasing,
        });
      }
    });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const compact = viewport.height > 0 && viewport.height < 540;
  const heroHeight = Math.min(Math.max(viewport.height * 0.46, compact ? 184 : 225), 275);

  return (
    <View style={styles.appBackground}>
      <SafeAreaView style={styles.shell} edges={['top', 'bottom']}>
        <AnimatedBackgroundLayer reducedMotion={reducedMotion} />

        <View style={styles.header}>
          <View style={styles.backButton}>
            <BackButton />
          </View>
          <Brand compact />
        </View>

        <GestureDetector gesture={panGesture}>
          <View style={styles.viewport} onLayout={onViewportLayout}>
            {viewport.width > 0 ? (
              <>
                <SceneryBack
                  width={viewport.width}
                  height={heroHeight}
                  reducedMotion={reducedMotion}
                />
                <SceneryFront
                  width={viewport.width}
                  height={heroHeight}
                  reducedMotion={reducedMotion}
                />
                <HeroMascotLayer
                  translateX={translateX}
                  width={viewport.width}
                  heroHeight={heroHeight}
                />

                <Animated.View
                  style={[
                    styles.track,
                    { width: viewport.width * PAGE_COUNT },
                    trackStyle,
                  ]}
                >
                  {pages.map((page) => (
                    <OnboardingPage
                      key={page.id}
                      page={page}
                      width={viewport.width}
                      height={viewport.height}
                      heroHeight={heroHeight}
                      compact={compact}
                    />
                  ))}
                </Animated.View>

              </>
            ) : null}
          </View>
        </GestureDetector>

        <View style={[styles.controls, compact && styles.controlsCompact]}>
          <Pagination translateX={translateX} width={viewport.width} onSelect={goToPage} />
          <PrimaryButton title="Get Started" onPress={() => router.push('/create-account')} />
          <SecondaryButton
            title="I already have an account"
            onPress={() => router.push('/sign-in')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function OnboardingPage({
  page,
  width,
  height,
  heroHeight,
  compact,
}: {
  page: OnboardingPageData;
  width: number;
  height: number;
  heroHeight: number;
  compact: boolean;
}) {
  return (
    <ScrollView
      style={[styles.page, { width, flexBasis: width }]}
      contentContainerStyle={[
        styles.pageContent,
        { minHeight: height },
        compact && styles.pageContentCompact,
      ]}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      bounces={false}
      scrollEnabled={compact}
    >
      {/* Spacer only: the mascot now lives in a fixed layer above the track so
          it can't slide away with the page. */}
      <View style={[styles.hero, styles.nonInteractive, { height: heroHeight }]} />

      <View style={[styles.copy, compact && styles.copyCompact]}>
        <AppText variant="title" style={[styles.title, compact && styles.titleCompact]}>
          {page.title}
        </AppText>
        <AppText style={[styles.description, compact && styles.descriptionCompact]}>
          {page.description}
        </AppText>

        <SummaryCard summary={page.summary} compact={compact} />
      </View>
    </ScrollView>
  );
}

function SummaryCard({
  summary,
  compact,
}: {
  summary: OnboardingPageData['summary'];
  compact: boolean;
}) {
  return (
    <Card style={[styles.summaryCard, compact && styles.summaryCardCompact]}>
      <View style={[styles.summaryIcon, compact && styles.summaryIconCompact]}>
        <AppIcon
          name={summary.icon}
          size={compact ? 25 : 29}
          color={colors.deepForest}
        />
      </View>
      <View style={styles.summaryCopy}>
        <AppText variant="h3" style={compact && styles.summaryTitleCompact}>
          {summary.title}
        </AppText>
        <AppText
          variant="small"
          style={[styles.summaryDescription, compact && styles.summaryDescriptionCompact]}
        >
          {summary.description}
        </AppText>
      </View>
    </Card>
  );
}

function Pagination({
  translateX,
  width,
  onSelect,
}: {
  translateX: SharedValue<number>;
  width: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.pagination} accessibilityRole="tablist">
      {pages.map((page, index) => (
        <PaginationDot
          key={page.id}
          index={index}
          width={width}
          translateX={translateX}
          onPress={() => onSelect(index)}
        />
      ))}
    </View>
  );
}

function PaginationDot({
  index,
  width,
  translateX,
  onPress,
}: {
  index: number;
  width: number;
  translateX: SharedValue<number>;
  onPress: () => void;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const position = width > 0 ? -translateX.value / width : 0;
    const distance = Math.abs(position - index);

    return {
      width: interpolate(distance, [0, 1], [22, 9], Extrapolation.CLAMP),
      opacity: interpolate(distance, [0, 1], [1, 0.55], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(
        distance,
        [0, 1],
        [colors.deepForest, colors.lightGreen],
      ),
    };
  });

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`Onboarding page ${index + 1} of ${PAGE_COUNT}`}
      onPress={onPress}
      hitSlop={10}
    >
      <Animated.View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
}

type FloatingShapeProps = {
  source: number;
  style: StyleProp<ImageStyle>;
  duration: number;
  driftX: number;
  driftY: number;
  rotation: number;
  scale: number;
  baseRotation?: number;
  reducedMotion: boolean;
};

function FloatingShape({
  source,
  style,
  duration,
  driftX,
  driftY,
  rotation,
  scale,
  baseRotation = 0,
  reducedMotion,
}: FloatingShapeProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 0.5;
      return () => cancelAnimation(progress);
    }

    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    return () => cancelAnimation(progress);
  }, [duration, progress, reducedMotion]);

  const motionStyle = useAnimatedStyle(() => {
    const centered = progress.value - 0.5;

    return {
      transform: [
        { translateX: centered * driftX },
        { translateY: centered * driftY },
        { rotate: `${baseRotation + centered * rotation}deg` },
        { scale: 1 + centered * scale },
      ],
    };
  });

  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      style={[style, motionStyle]}
    />
  );
}

function AnimatedBackgroundLayer({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <View style={styles.backgroundLayer} accessible={false}>
      <FloatingShape
        source={assets.shape1}
        style={styles.cornerTopLeft}
        duration={7_200}
        driftX={30}
        driftY={22}
        rotation={5}
        scale={0.05}
        baseRotation={22}
        reducedMotion={reducedMotion}
      />
      <FloatingShape
        source={assets.shape2}
        style={styles.cornerTopRight}
        duration={8_800}
        driftX={-26}
        driftY={32}
        rotation={-5}
        scale={0.045}
        baseRotation={-28}
        reducedMotion={reducedMotion}
      />
      <FloatingShape
        source={assets.shape3}
        style={styles.leafShape}
        duration={6_500}
        driftX={34}
        driftY={-28}
        rotation={6}
        scale={0.05}
        baseRotation={-32}
        reducedMotion={reducedMotion}
      />
      <FloatingShape
        source={assets.shape1}
        style={styles.cornerBottomRight}
        duration={7_900}
        driftX={-28}
        driftY={26}
        rotation={-5.5}
        scale={0.045}
        baseRotation={154}
        reducedMotion={reducedMotion}
      />

      {/* Bottom band. Anchored past the bottom edge and clipped by the shell,
          so it reads as ground filling the space under the CTAs rather than a
          floating blob. Slower and smaller-amplitude than the upper shapes so
          it doesn't pull attention from the buttons sitting on top of it. */}
      <FloatingShape
        source={assets.shape5}
        style={styles.bottomLandscape}
        duration={12_400}
        driftX={16}
        driftY={-10}
        rotation={1.4}
        scale={0.02}
        baseRotation={-4}
        reducedMotion={reducedMotion}
      />
      <FloatingShape
        source={assets.shape4}
        style={styles.bottomLandscapeFront}
        duration={10_600}
        driftX={-18}
        driftY={12}
        rotation={-1.8}
        scale={0.025}
        baseRotation={6}
        reducedMotion={reducedMotion}
      />
      <FloatingShape
        source={assets.shape3}
        style={styles.bottomAccent}
        duration={8_300}
        driftX={12}
        driftY={-14}
        rotation={3}
        scale={0.04}
        baseRotation={-38}
        reducedMotion={reducedMotion}
      />
    </View>
  );
}

// The mascot sits outside the swiping track: all three are mounted at once and
// cross-fade as the track moves, so swiping never leaves an empty hero. It also
// rides lower than the scenery blobs so it reads as standing in front of them
// rather than covering them.
function HeroMascotLayer({
  translateX,
  width,
  heroHeight,
}: {
  translateX: SharedValue<number>;
  width: number;
  heroHeight: number;
}) {
  return (
    <View style={[styles.mascotLayer, { height: heroHeight }]} accessible={false}>
      {pages.map((page, index) => (
        <HeroMascot
          key={page.id}
          source={page.mascot}
          index={index}
          translateX={translateX}
          width={width}
          heroHeight={heroHeight}
        />
      ))}
    </View>
  );
}

function HeroMascot({
  source,
  index,
  translateX,
  width,
  heroHeight,
}: {
  source: ImageSource;
  index: number;
  translateX: SharedValue<number>;
  width: number;
  heroHeight: number;
}) {
  const mascotWidth = Math.min(width * 0.6, 236);

  const fadeStyle = useAnimatedStyle(() => {
    const page = width > 0 ? -translateX.value / width : 0;
    const distance = Math.abs(page - index);
    return {
      opacity: interpolate(distance, [0, 0.85], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 1], [1, 0.94], Extrapolation.CLAMP) }],
    };
  });

  return (
    <AnimatedExpoImage
      source={source}
      contentFit="contain"
      style={[
        styles.mascot,
        {
          width: mascotWidth,
          height: heroHeight * 0.78,
          marginLeft: -mascotWidth / 2,
          bottom: -heroHeight * 0.14,
        },
        fadeStyle,
      ]}
    />
  );
}

function SceneryBack({
  width,
  height,
  reducedMotion,
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  return (
    <View style={[styles.scenery, { height }]} accessible={false}>
      <FloatingShape
        source={assets.shape4}
        style={[
          styles.sceneryBack,
          { width: width * 1.28, height: height * 1.08, left: -width * 0.14 },
        ]}
        duration={9_500}
        driftX={20}
        driftY={-15}
        rotation={2}
        scale={0.025}
        reducedMotion={reducedMotion}
      />
      <FloatingShape
        source={assets.shape5}
        style={[
          styles.sceneryMiddle,
          { width: width * 1.36, height, left: -width * 0.2 },
        ]}
        duration={11_200}
        driftX={-24}
        driftY={18}
        rotation={-2.4}
        scale={0.035}
        reducedMotion={reducedMotion}
      />
    </View>
  );
}

function SceneryFront({
  width,
  height,
  reducedMotion,
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  return (
    <View
      style={[styles.scenery, { height }]}
      accessible={false}
    >
      <FloatingShape
        source={assets.shape6}
        style={[
          styles.sceneryFront,
          { width: width * 1.48, height: height * 0.72, left: -width * 0.24 },
        ]}
        duration={8_200}
        driftX={22}
        driftY={-20}
        rotation={2.6}
        scale={0.03}
        baseRotation={4}
        reducedMotion={reducedMotion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appBackground: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    overflow: 'hidden',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: SHELL_MAX_WIDTH,
    backgroundColor: 'rgba(245, 242, 232, 0.88)',
    overflow: 'hidden',
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  cornerTopLeft: {
    position: 'absolute',
    width: 220,
    height: 205,
    left: -72,
    top: -58,
    opacity: 0.4,
  },
  cornerTopRight: {
    position: 'absolute',
    width: 205,
    height: 205,
    right: -66,
    top: -45,
    opacity: 0.36,
  },
  leafShape: {
    position: 'absolute',
    width: 235,
    height: 235,
    left: -108,
    bottom: 132,
    opacity: 0.3,
  },
  cornerBottomRight: {
    position: 'absolute',
    width: 190,
    height: 180,
    right: -92,
    bottom: 116,
    opacity: 0.24,
  },
  bottomLandscape: {
    position: 'absolute',
    width: '150%',
    height: 260,
    left: '-25%',
    bottom: -96,
    opacity: 0.55,
  },
  bottomLandscapeFront: {
    position: 'absolute',
    width: '132%',
    height: 215,
    left: '-16%',
    bottom: -104,
    opacity: 0.42,
  },
  bottomAccent: {
    position: 'absolute',
    width: 150,
    height: 150,
    right: -46,
    bottom: -30,
    opacity: 0.30,
  },
  header: {
    height: HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  backButton: {
    position: 'absolute',
    left: 18,
    top: 10,
    zIndex: 2,
  },
  viewport: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  track: {
    height: '100%',
    flexDirection: 'row',
    zIndex: 1,
  },
  page: {
    height: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  pageContent: {
    paddingBottom: 16,
  },
  pageContentCompact: {
    paddingBottom: 10,
  },
  hero: {
    position: 'relative',
  },
  nonInteractive: {
    pointerEvents: 'none',
  },
  mascotLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'visible',
    pointerEvents: 'none',
  },
  mascot: {
    position: 'absolute',
    left: '50%',
  },
  scenery: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  sceneryBack: {
    position: 'absolute',
    top: -74,
    opacity: 0.78,
  },
  sceneryMiddle: {
    position: 'absolute',
    top: -35,
    opacity: 0.92,
  },
  sceneryFront: {
    position: 'absolute',
    bottom: -74,
    opacity: 0.62,
  },
  copy: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 12,
  },
  copyCompact: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 7,
  },
  title: {
    maxWidth: 390,
    textAlign: 'center',
    fontSize: 36,
    lineHeight: 42,
  },
  titleCompact: {
    fontSize: 30,
    lineHeight: 35,
  },
  description: {
    maxWidth: 390,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  descriptionCompact: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 1,
  },
  summaryCard: {
    width: '100%',
    minHeight: 96,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: 'rgba(255, 253, 247, 0.96)',
  },
  summaryCardCompact: {
    minHeight: 72,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 11,
  },
  summaryIcon: {
    width: 64,
    height: 64,
    borderRadius: 21,
    backgroundColor: '#DCE8D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconCompact: {
    width: 50,
    height: 50,
    borderRadius: 17,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryTitleCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  summaryDescription: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 17,
  },
  summaryDescriptionCompact: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  controls: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 52,
    gap: 10,
    // Transparent so the bottom scenery reads through behind the CTAs. The
    // buttons carry their own solid fills, so contrast is unaffected.
    backgroundColor: 'transparent',
    zIndex: 4,
  },
  controlsCompact: {
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 32,
    gap: 7,
  },
  pagination: {
    height: 22,
    marginBottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 9,
    borderRadius: radii.pill,
  },
});
