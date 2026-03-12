import { View, StyleSheet, Dimensions, ImageBackground } from "react-native";
import React, { useState } from "react";
import Carousel from "react-native-snap-carousel";
import { COLORS } from "@constants/theme";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const BANNERS = [
  { image: require("@assets/images/Home/Banner/banner_1.jpg") },
  { image: require("@assets/images/Home/Banner/banner_2.jpg") },
  { image: require("@assets/images/Home/Banner/banner_3.jpg") },
];

const BannerCard = ({ item }) => (
  <ImageBackground
    source={item.image}
    style={styles.bannerCard}
    imageStyle={styles.bannerImage}
    resizeMode="cover"
  />
);

const CarouselPagination = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <View>
      <Carousel
        data={BANNERS}
        renderItem={({ item }) => <BannerCard item={item} />}
        sliderWidth={screenWidth - 20}
        itemWidth={screenWidth - 20}
        autoplay={true}
        loop={true}
        autoplayDelay={500}
        autoplayInterval={3000}
        enableMomentum={false}
        lockScrollWhileSnapping={true}
        containerCustomStyle={styles.carouselContainer}
        onSnapToItem={(index) => setActiveSlide(index)}
      />
      <View style={styles.dotsRow}>
        {BANNERS.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeSlide ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default CarouselPagination;

const styles = StyleSheet.create({
  carouselContainer: {
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 2,
  },
  bannerCard: {
    borderRadius: 16,
    height: screenHeight * 0.2,
    overflow: "hidden",
  },
  bannerImage: {
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
