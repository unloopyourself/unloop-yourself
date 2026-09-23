import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { CORE_PACKAGE_NAME, SessionFsm } from "@unloop/core";

const fsm = new SessionFsm();

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Unloop</Text>
      <Text style={styles.meta}>
        {CORE_PACKAGE_NAME} · session {fsm.state}
      </Text>
      <Text style={styles.copy}>
        I interrupt because you asked me to — scaffolding only; monitoring comes next.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7f5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brand: {
    fontSize: 36,
    fontWeight: "700",
    color: "#1a3c34",
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: "#4a635c",
    marginBottom: 16,
  },
  copy: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: "#24352f",
  },
});
