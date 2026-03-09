import React, { useRef, useState, useImperativeHandle, useCallback } from "react";
import { View, PanResponder, StyleSheet } from "react-native";
import { captureRef } from "react-native-view-shot";
import Svg, { Path } from "react-native-svg";

const SignaturePad = React.forwardRef(({ style, strokeColor = "#000", strokeWidth = 3 }, ref) => {
  const [version, setVersion] = useState(0); // bump to trigger re-render
  const pathsRef = useRef([]); // all completed strokes
  const activeRef = useRef([]); // current in-progress stroke points
  const containerRef = useRef(null);
  const offset = useRef({ x: 0, y: 0 });
  const frameRef = useRef(null);

  useImperativeHandle(ref, () => ({
    clearSignature: () => {
      pathsRef.current = [];
      activeRef.current = [];
      setVersion((v) => v + 1);
    },
    readSignature: async () => {
      if (pathsRef.current.length === 0) return null;
      try {
        return await captureRef(containerRef, { format: "png", quality: 0.8 });
      } catch (e) {
        return null;
      }
    },
    isEmpty: () => pathsRef.current.length === 0 && activeRef.current.length === 0,
  }));

  const measureLayout = useCallback(() => {
    if (containerRef.current?.measureInWindow) {
      try {
        containerRef.current.measureInWindow((x, y) => { offset.current = { x, y }; });
      } catch (e) {}
    }
  }, []);

  const scheduleRender = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setVersion((v) => v + 1);
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        activeRef.current = [{ x: pageX - offset.current.x, y: pageY - offset.current.y }];
        scheduleRender();
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        activeRef.current.push({ x: pageX - offset.current.x, y: pageY - offset.current.y });
        scheduleRender();
      },
      onPanResponderRelease: () => {
        if (activeRef.current.length > 0) {
          pathsRef.current.push(activeRef.current);
        }
        activeRef.current = [];
        scheduleRender();
      },
      onPanResponderTerminate: () => {
        if (activeRef.current.length > 0) {
          pathsRef.current.push(activeRef.current);
        }
        activeRef.current = [];
        scheduleRender();
      },
    })
  ).current;

  const toD = (pts) => {
    if (!pts || pts.length < 1) return "";
    let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    return d;
  };

  // Read current paths from refs (not state) for zero-copy rendering
  const allPaths = pathsRef.current;
  const active = activeRef.current;

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      collapsable={false}
      onLayout={measureLayout}
      {...panResponder.panHandlers}
    >
      <Svg style={StyleSheet.absoluteFill}>
        {allPaths.map((pts, idx) => (
          <Path key={idx} d={toD(pts)} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {active.length > 0 && (
          <Path d={toD(active)} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", overflow: "hidden" },
});

export default SignaturePad;
