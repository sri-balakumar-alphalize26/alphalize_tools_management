// AlertHost: a tiny event-bus + modal host that lets any code in the app
// call `showAlert(title, message, buttons)` without prop-drilling. Drops in
// as a replacement for React Native's `Alert.alert` so converting existing
// call sites is a near-find-and-replace.
//
// Usage:
//   import showAlert from "@components/Modal/alertHost";
//   showAlert("Delete?", "This can't be undone.", [
//     { text: "Cancel", style: "cancel" },
//     { text: "Delete", style: "destructive", onPress: () => doDelete() },
//   ]);
//
// Mount <AlertHost /> once in App.js so the modal has a place to render.

import React, { useEffect, useState } from "react";
import StyledConfirmModal from "@components/Modal/StyledConfirmModal";

// Simple subscriber list — only one host should ever be mounted, but
// using an array keeps things robust if Fast Refresh duplicates briefly.
const subscribers = new Set();

let _state = null;

const emit = () => {
  subscribers.forEach((cb) => {
    try { cb(_state); } catch (_) {}
  });
};

// Public API — mirrors Alert.alert(title, message, buttons).
export function showAlert(title, message, buttons) {
  const list = Array.isArray(buttons) && buttons.length > 0
    ? buttons
    : [{ text: "OK", style: "default" }];

  // Map RN's Alert button shape ({text, onPress, style}) to our modal's
  // shape ({label, onPress, style}). Accept either key.
  const normalized = list.map((b) => ({
    label: b.label || b.text || "OK",
    onPress: b.onPress,
    style: b.style || "default",
  }));

  _state = {
    title: title || "",
    message: message || "",
    buttons: normalized.map((b) => ({
      ...b,
      onPress: () => {
        try { if (b.onPress) b.onPress(); } finally { dismiss(); }
      },
    })),
  };
  emit();
}

function dismiss() {
  _state = null;
  emit();
}

export const AlertHost = () => {
  const [state, setState] = useState(_state);

  useEffect(() => {
    const cb = (next) => setState(next);
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  }, []);

  if (!state) return null;

  return (
    <StyledConfirmModal
      isVisible
      title={state.title}
      message={state.message}
      buttons={state.buttons}
      onDismiss={dismiss}
    />
  );
};

export default showAlert;
