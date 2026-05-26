// Dynamic banner carousel. Replaces the old static CarouselPagination
// (which pointed at bundled assets/images/Home/Banner/*.jpg). This one
// fetches from the Odoo `app.banner` module via bannerApi and renders
// only the active rows. Returns null when there are no banners so the
// home screen has no broken placeholder.

import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Dimensions, Image } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Carousel from "react-native-snap-carousel";
import { COLORS } from "@constants/theme";
import { fetchActiveBanners } from "@api/services/bannerApi";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const BannerCarousel = () => {
  const [data, setData] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    console.log("[BANNER] carousel mount", { screenWidth, screenHeight });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        console.log("[BANNER] carousel focus refresh fetching…");
        const rows = await fetchActiveBanners();
        if (!alive) return;
        if (Array.isArray(rows) && rows.length > 0) {
          console.log("[BANNER] carousel got rows", rows.length);
          setData(
            rows.map((r) => ({
              id: r.id,
              name: r.name,
              uri: `data:image/jpeg;base64,${r.image}`,
            }))
          );
        } else {
          console.log("[BANNER] carousel hiding (no rows)");
          setData([]);
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  // When there are no banners, keep the SAME footprint (same height +
  // margins) so the home layout doesn't shift as banners come and go.
  // Just render an empty card-shaped placeholder.
  if (data.length === 0) {
    return (
      <View>
        <View style={styles.carouselContainer}>
          <View style={[styles.bannerCard, styles.emptyCard]} />
        </View>
      </View>
    );
  }

  const renderItem = ({ item }) => (
    <View style={styles.bannerCard}>
      <Image
        source={{ uri: item.uri }}
        style={styles.bannerImage}
        resizeMode="cover"
        resizeMethod="resize"
        fadeDuration={0}
        onLoad={(e) =>
          console.log("[BANNER] image LOADED", {
            id: item.id,
            w: e?.nativeEvent?.source?.width,
            h: e?.nativeEvent?.source?.height,
          })
        }
        onError={(e) =>
          console.warn("[BANNER] image ERROR", {
            id: item.id,
            reason: e?.nativeEvent?.error,
          })
        }
      />
    </View>
  );

  return (
    <View>
      <Carousel
        data={data}
        renderItem={renderItem}
        sliderWidth={screenWidth}
        itemWidth={screenWidth - 60}
        autoplay={data.length > 1}
        loop={data.length > 1}
        autoplayDelay={500}
        autoplayInterval={3000}
        inactiveSlideScale={0.9}
        inactiveSlideOpacity={0.7}
        activeSlideAlignment="center"
        enableMomentum={false}
        lockScrollWhileSnapping={true}
        containerCustomStyle={styles.carouselContainer}
        onSnapToItem={setActiveSlide}
      />
      {data.length > 1 ? (
        <View style={styles.dotsRow}>
          {data.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeSlide ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default BannerCarousel;

const styles = StyleSheet.create({
  carouselContainer: {
    marginTop: 4,
    marginBottom: 2,
  },
  bannerCard: {
    // Match Grocery_shop's 3:1 banner aspect ratio (width:height).
    aspectRatio: 3,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#eee",
  },
  emptyCard: {
    // Same footprint as a real banner card; left empty so the home
    // layout doesn't shift when banners come and go.
    width: screenWidth - 60,
    alignSelf: "center",
    backgroundColor: "#f5f5f5",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
  dot: {
    borderRadius: 5,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 22,
    height: 8,
    backgroundColor: COLORS.tabColor,
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: "#D0D0D0",
    opacity: 0.6,
  },
});
