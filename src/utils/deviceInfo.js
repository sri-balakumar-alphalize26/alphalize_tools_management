import * as Device from "expo-device";

// Best-available human-readable name for this device. Used in the Odoo
// device.registry "Device Name" column.
//   - deviceName: user-chosen friendly name (e.g. "Sri's iPhone"). Null on
//     Android without permission and on web.
//   - modelName: marketing model ("Galaxy Tab A", "iPhone 15 Pro"). Most
//     reliable cross-platform.
//   - modelId:   raw model identifier ("iPhone16,1"). Last resort.
export const getDeviceName = () =>
  Device.deviceName || Device.modelName || Device.modelId || "Unknown Device";

export default getDeviceName;
