import React, { useRef, useState, useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Modal, Image } from "react-native";
import { Camera } from "expo-camera";

const CameraCapture = ({ visible, onCapture, onClose }) => {
  const cameraRef = useRef(null);
  const [type, setType] = useState(Camera.Constants.Type.back);
  const [preview, setPreview] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
      })();
    }
  }, [visible]);

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setPreview(photo.uri);
    } catch (e) {
      console.warn("Take picture error:", e);
    }
  };

  const confirmPhoto = () => {
    if (preview) {
      onCapture(preview);
      setPreview(null);
    }
  };

  const retakePhoto = () => {
    setPreview(null);
  };

  const handleClose = () => {
    setPreview(null);
    onClose();
  };

  if (hasPermission === null) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Requesting camera permission...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {!hasPermission ? (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>Camera permission is required</Text>
            <TouchableOpacity
              style={styles.permissionBtn}
              onPress={async () => {
                const { status } = await Camera.requestCameraPermissionsAsync();
                setHasPermission(status === "granted");
              }}
            >
              <Text style={styles.permissionBtnText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : preview ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: preview }} style={styles.previewImage} />
            <View style={styles.previewBtnRow}>
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: "#F44336" }]} onPress={retakePhoto}>
                <Text style={styles.previewBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.previewBtn, { backgroundColor: "#4CAF50" }]} onPress={confirmPhoto}>
                <Text style={styles.previewBtnText}>Use Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Camera ref={cameraRef} style={styles.camera} type={type} />
            <View style={styles.controls}>
              <TouchableOpacity style={styles.controlBtn} onPress={handleClose}>
                <Text style={styles.controlBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() =>
                  setType((t) =>
                    t === Camera.Constants.Type.back
                      ? Camera.Constants.Type.front
                      : Camera.Constants.Type.back
                  )
                }
              >
                <Text style={styles.controlBtnText}>Flip</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  controls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: "#000",
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  controlBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  controlBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  previewContainer: { flex: 1, backgroundColor: "#000" },
  previewImage: { flex: 1, resizeMode: "contain" },
  previewBtnRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingBottom: 40,
    backgroundColor: "#000",
  },
  previewBtn: { paddingHorizontal: 30, paddingVertical: 14, borderRadius: 8 },
  previewBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  permissionContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  permissionText: { color: "#fff", fontSize: 16, marginBottom: 20, textAlign: "center" },
  permissionBtn: { backgroundColor: "#2196F3", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginBottom: 12 },
  permissionBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  closeBtn: { paddingHorizontal: 24, paddingVertical: 12 },
  closeBtnText: { color: "#999", fontSize: 15 },
});

export default CameraCapture;
