import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ListRenderItemInfo } from 'react-native';

// Color Theme - matching home and explore pages
const COLORS = {
  background: '#062f66',
  cardBackground: '#FFFFFF',
  primary: '#2743bc',
  yellow: '#ffbd59',
  red: '#e34348',
  cream: '#ffd59a',
  textPrimary: '#062f66',
  textSecondary: '#5a6c8c',
  textLight: '#8892a8',
  textOnDark: '#FFFFFF',
  border: '#E5E7EB',
  shadow: '#000000',
};

const SLIDES = [
  {
    id: '1',
    title: 'Discover Local Events',
    description: 'Browse nearby events and quickly find activities that match your interests.',
  },
  {
    id: '2',
    title: 'Post What You Are Hosting',
    description: 'Create your own event posts to invite neighbors and build community.',
  },
  {
    id: '3',
    title: 'Chat With Your Village',
    description: 'Message directly in the app to coordinate plans and stay connected.',
  },
];

type Slide = (typeof SLIDES)[number];

export default function LandingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const goToSlide = (index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
    setActiveSlide(index);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % SLIDES.length;
        listRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const renderSlide = ({ item }: ListRenderItemInfo<Slide>) => {
    return (
      <View style={[styles.slide, { width }]}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </View>
    );
  };

  const onMomentumEnd = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveSlide(nextIndex);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Village</Text>
        <Text style={styles.subtitle}>Your neighborhood social hub</Text>

        <View style={styles.carouselContainer}>
          <FlatList
            ref={listRef}
            data={SLIDES}
            renderItem={renderSlide}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={onMomentumEnd}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          />
        </View>

        <View style={styles.dotsRow}>
          {SLIDES.map((slide, index) => (
            <Pressable
              key={slide.id}
              onPress={() => goToSlide(index)}
              style={[styles.dot, activeSlide === index && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable style={styles.button} onPress={() => router.push('/login')}>
          <Text style={styles.buttonText}>Log In / Sign Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  title: {
    fontSize: 60,
    fontWeight: '900',
    marginBottom: 2,
    color: COLORS.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  subtitle: {
    color: COLORS.cream,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  carouselContainer: {
    minHeight: 220,
    justifyContent: 'center',
  },
  slide: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
    gap: 14,
  },
  slideTitle: {
    color: COLORS.textPrimary,
    fontSize: 34,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  slideDescription: {
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#87a0bf',
  },
  dotActive: {
    width: 28,
    backgroundColor: COLORS.yellow,
  },
  button: {
    marginTop: 24,
    marginBottom: 24,
    backgroundColor: COLORS.yellow,
    borderRadius: 0,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.yellow,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
