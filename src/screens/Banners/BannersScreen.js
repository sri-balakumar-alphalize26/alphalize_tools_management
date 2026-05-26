import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, RoundedContainer } from "@components/containers";
import NavigationHeader from "@components/Header/NavigationHeader";
import { showToastMessage } from "@components/Toast";
import { COLORS, FONT_FAMILY } from "@constants/theme";
import { fetchAllBanners } from "@api/services/bannerApi";

const BannersScreen = ({ navigation }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log("[BANNER] BannersScreen mount");
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    console.log("[BANNER] list focus refresh", { isRefresh });
    const res = await fetchAllBanners();
    if (res?.error) {
      console.warn("[BANNER] list load error", res.error);
      showToastMessage(res.error);
      setRows([]);
    } else {
      console.log("[BANNER] list got rows", res.rows?.length || 0);
      setRows(res.rows || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate("BannerDetailsScreen", {
          mode: "edit",
          banner: item,
        })
      }
    >
      {item.image ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.image}` }}
          style={styles.thumb}
          resizeMode="cover"
          resizeMethod="resize"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <MaterialIcons name="image-not-supported" size={22} color="#9CA3AF" />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.name || `Banner #${item.id}`}
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[styles.dot, item.active ? styles.dotOn : styles.dotOff]}
          />
          <Text style={styles.statusText}>
            {item.active ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView backgroundColor={COLORS.primaryThemeColor}>
      <NavigationHeader title="App Banners" navigation={navigation} />
      <RoundedContainer>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primaryThemeColor} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => `banner-${item.id}`}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <MaterialIcons name="image" size={48} color="#cfcfd9" />
                <Text style={styles.emptyText}>No banners yet</Text>
                <Text style={styles.emptySub}>
                  Tap the + button to add one.
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={COLORS.primaryThemeColor}
              />
            }
          />
        )}

        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("BannerDetailsScreen", { mode: "create" })
          }
        >
          <MaterialIcons name="add-photo-alternate" size={22} color="#fff" />
          <Text style={styles.fabText}>New Banner</Text>
        </TouchableOpacity>
      </RoundedContainer>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 14,
    paddingBottom: 120,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#1a1a2e",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumb: {
    width: 84,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#F1F2F6",
  },
  thumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: COLORS.primaryThemeColor,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotOn: { backgroundColor: "#22C55E" },
  dotOff: { backgroundColor: "#9CA3AF" },
  statusText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#666",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: FONT_FAMILY.urbanistBold,
    color: "#666",
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.urbanistMedium,
    color: "#999",
    marginTop: 4,
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryThemeColor,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 14,
    fontFamily: FONT_FAMILY.urbanistBold,
  },
});

export default BannersScreen;
