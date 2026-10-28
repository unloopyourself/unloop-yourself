import { StyleSheet } from "react-native";
import { colors, typography } from "../theme";

/** Shared layout tokens for interrupt challenge screens. */
export const challengeStyles = StyleSheet.create({
  wrap: { width: "100%", alignItems: "center", gap: 12 },
  title: {
    fontSize: typography.titleSize,
    fontWeight: "800",
    color: colors.white,
  },
  subtitle: {
    fontSize: typography.bodySize,
    lineHeight: 24,
    textAlign: "center",
    color: colors.textOnInk,
  },
  meta: { color: colors.emberSoft, fontWeight: "700", fontSize: 18 },
  prompt: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.emberSoft,
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.emberSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 18,
    textAlign: "center",
    backgroundColor: colors.inkSoft,
  },
  btn: {
    backgroundColor: colors.ember,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 160,
    alignItems: "center",
  },
  btnLabel: { color: colors.white, fontWeight: "700", fontSize: 16 },
  btnGhost: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.emberSoft,
    minWidth: 140,
    alignItems: "center",
  },
  btnGhostLabel: { color: colors.textOnInk, fontWeight: "700", fontSize: 16 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { color: colors.white, fontWeight: "800", fontSize: 18 },
  barTrack: {
    width: "100%",
    height: 14,
    backgroundColor: colors.inkSoft,
    borderRadius: 8,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.ember,
  },
});
