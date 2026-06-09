import { useAuthStore } from "@stores/auth";

// Returns true when the given app-feature key is hidden for the current user,
// per the privilege gating loaded into the auth store. Tag any UI element with
// its catalog feature_key and conditionally render based on this hook.
export const useFeatureHidden = (key) =>
  useAuthStore((s) => (s.hiddenFeatures || []).includes(key));

export default useFeatureHidden;
