import { LogBox } from "react-native";
import { registerRootComponent } from "expo";

import App from "./App";

// Embedded debug APKs run without Metro; yellow LogBox banners block L3 taps.
LogBox.ignoreAllLogs(true);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
