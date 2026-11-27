import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/** Hairline used between sections; derived from `colors.ink` at low alpha. */
export const SECTION_DIVIDER = "rgba(10,37,64,0.12)";

/** Minimum touch target (dp) for rows and controls. */
export const MIN_TOUCH = 48;

type SectionProps = {
  title: string;
  /** Short helper line under the title (always visible). */
  subtitle?: string;
  children: ReactNode;
};

/** Static section: title + content, separated from the previous one by a hairline. */
export function Section({ title, subtitle, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headerStatic}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

type CollapsibleProps = SectionProps & {
  expanded: boolean;
  onToggle: () => void;
  /** Shown at the right of the header while collapsed (e.g. "3 of 12 on"). */
  summary?: string;
  /** Localized "Tap to expand" / "Tap to collapse" hint for screen readers. */
  hint: string;
  /** Visual weight: "section" matches `Section`; "inline" is a lighter sub-disclosure. */
  variant?: "section" | "inline";
};

/**
 * Disclosure section. Header is one full-width 48dp+ button with a chevron;
 * state lives in the parent so it can be session-scoped or persisted later.
 */
export function CollapsibleSection({
  title,
  subtitle,
  summary,
  hint,
  expanded,
  onToggle,
  children,
  variant = "section",
}: CollapsibleProps) {
  const inline = variant === "inline";
  return (
    <View style={inline ? styles.inline : styles.section}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.headerPress,
          pressed && styles.headerPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={summary ? `${title}, ${summary}` : title}
        accessibilityState={{ expanded }}
        accessibilityHint={hint}
      >
        <View style={styles.headerText}>
          <Text
            style={inline ? styles.inlineTitle : styles.title}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {!expanded && summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.textMuted}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

type ToggleRowProps = {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Optional one-line explanation under the label. */
  description?: string;
};

/** Full-row switch: the whole row is the touch target. */
export function ToggleRow({
  label,
  value,
  onValueChange,
  description,
}: ToggleRowProps) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={styles.toggleRow}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? (
          <Text style={styles.subtitle}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.chipOff, true: colors.teal }}
        thumbColor={colors.white}
        // The row handles accessibility; avoid a duplicate focus stop.
        accessible={false}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

type NavRowProps = {
  label: string;
  onPress: () => void;
};

/** Full-width row that navigates elsewhere (chevron on the right). */
export function NavRow({ label, onPress }: NavRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && styles.headerPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.navLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SECTION_DIVIDER,
    paddingTop: 4,
    paddingBottom: 8,
  },
  inline: {
    width: "100%",
  },
  headerStatic: {
    minHeight: 40,
    justifyContent: "center",
    paddingTop: 8,
    gap: 2,
  },
  headerPress: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerPressed: { backgroundColor: "rgba(10,37,64,0.06)" },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  inlineTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  subtitle: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  summary: { fontSize: 13, lineHeight: 18, color: colors.teal, fontWeight: "600" },
  body: { gap: 14, paddingTop: 6, paddingBottom: 6 },
  toggleRow: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  toggleText: { flex: 1, gap: 2 },
  navLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
  navRow: {
    minHeight: MIN_TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
