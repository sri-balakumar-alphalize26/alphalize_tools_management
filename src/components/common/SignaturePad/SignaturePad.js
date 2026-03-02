import React, { useRef, useState } from "react";
import { View, PanResponder, StyleSheet } from "react-native";
import { captureRef } from "react-native-view-shot";

const SignaturePad = React.forwardRef(({ style, strokeColor = "#000", strokeWidth = 3 }, ref) => {
  const [paths, setPaths] = useState([]);
  const currentPath = useRef([]);
  const containerRef = useRef(null);

  React.useImperativeHandle(ref, () => ({
    clearSignature: () => {
      setPaths([]);
      currentPath.current = [];
    },
    readSignature: async () => {
      if (paths.length === 0) return null;
      try {
        const uri = await captureRef(containerRef, {
          format: "png",
          quality: 0.8,
        });
        return uri;
      } catch {
        return null;
      }
    },
    isEmpty: () => paths.length === 0,
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current = [{ x: locationX, y: locationY }];
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current = [...currentPath.current, { x: locationX, y: locationY }];
        setPaths((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1]._active) {
            updated[updated.length - 1] = { points: [...currentPath.current], _active: true };
          } else {
            updated.push({ points: [...currentPath.current], _active: true });
          }
          return updated;
        });
      },
      onPanResponderRelease: () => {
        setPaths((prev) => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[updated.length - 1] = { ...updated[updated.length - 1], _active: false };
          }
          return updated;
        });
        currentPath.current = [];
      },
    })
  ).current;

  const renderPath = (path, index) => {
    if (!path.points || path.points.length < 2) {
      if (path.points && path.points.length === 1) {
        return (
          <View
            key={index}
            style={{
              position: "absolute",
              left: path.points[0].x - strokeWidth / 2,
              top: path.points[0].y - strokeWidth / 2,
              width: strokeWidth,
              height: strokeWidth,
              borderRadius: strokeWidth / 2,
              backgroundColor: strokeColor,
            }}
          />
        );
      }
      return null;
    }

    return path.points.map((point, i) => {
      if (i === 0) return null;
      const prev = path.points[i - 1];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      return (
        <View
          key={`${index}-${i}`}
          style={{
            position: "absolute",
            left: prev.x,
            top: prev.y - strokeWidth / 2,
            width: length,
            height: strokeWidth,
            backgroundColor: strokeColor,
            borderRadius: strokeWidth / 2,
            transform: [{ rotate: `${angle}deg` }],
            transformOrigin: "left center",
          }}
        />
      );
    });
  };

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      {...panResponder.panHandlers}
      collapsable={false}
    >
      {paths.map((path, index) => renderPath(path, index))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    overflow: "hidden",
  },
});

export default SignaturePad;
