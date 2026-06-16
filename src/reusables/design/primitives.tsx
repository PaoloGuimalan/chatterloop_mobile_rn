/* Shared primitives — RN equivalents of webapp/src/reusables/design.
 *
 * Naming matches the webapp (Btn, IconBtn, Card, Field, etc.) so screen
 * code can be ported with minimal edits. */

import React, { ReactNode, useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { radii } from "./tokens";
import { useTheme } from "./ThemeProvider";

// -------- Icon --------------------------------------------------------------

export function CLIcon({
  n,
  size = 22,
  color,
  style,
}: {
  n: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { palette } = useTheme();
  return (
    <Icon name={n} size={size} color={color || palette.text} style={style} />
  );
}

// -------- Btn ---------------------------------------------------------------

type BtnVariant = "primary" | "soft" | "ghost" | "outline" | "danger";
type BtnSize = "sm" | "md" | "lg";

export interface BtnProps extends Omit<TouchableOpacityProps, "children" | "style"> {
  label?: ReactNode;
  children?: ReactNode;
  variant?: BtnVariant;
  size?: BtnSize;
  iconL?: string;
  iconR?: string;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Btn({
  label,
  children,
  variant = "primary",
  size = "md",
  iconL,
  iconR,
  block,
  disabled,
  style,
  ...rest
}: BtnProps) {
  const { palette } = useTheme();
  const sz = { sm: { h: 32, px: 12, fs: 13 }, md: { h: 38, px: 16, fs: 14 }, lg: { h: 46, px: 22, fs: 15 } }[size];

  const variants: Record<BtnVariant, ViewStyle> = {
    primary: { backgroundColor: palette.brand },
    soft: { backgroundColor: palette.brandSoft },
    ghost: { backgroundColor: "transparent" },
    outline: { backgroundColor: palette.surface, borderColor: palette.border2, borderWidth: 1 },
    danger: { backgroundColor: palette.pink },
  };

  const textColor: Record<BtnVariant, string> = {
    primary: "#fff",
    soft: palette.brand,
    ghost: palette.text,
    outline: palette.text,
    danger: "#fff",
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      style={[
        styles.btn,
        variants[variant],
        { height: sz.h, paddingHorizontal: sz.px, opacity: disabled ? 0.55 : 1 },
        block && { alignSelf: "stretch" },
        style,
      ]}
      {...rest}
    >
      {iconL ? <CLIcon n={iconL} size={sz.fs + 4} color={textColor[variant]} /> : null}
      <Text style={{ color: textColor[variant], fontSize: sz.fs, fontWeight: "600" }}>
        {label ?? children}
      </Text>
      {iconR ? <CLIcon n={iconR} size={sz.fs + 4} color={textColor[variant]} /> : null}
    </TouchableOpacity>
  );
}

// -------- IconBtn -----------------------------------------------------------

export function IconBtn({
  n,
  size = 40,
  iconSize = 22,
  color,
  onPress,
  style,
}: {
  n: string;
  size?: number;
  iconSize?: number;
  color?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radii.sm,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <CLIcon n={n} size={iconSize} color={color || palette.text2} />
    </TouchableOpacity>
  );
}

// -------- Card --------------------------------------------------------------

export function Card({
  children,
  style,
  padding = 16,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: radii.md,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// -------- Field -------------------------------------------------------------

export interface FieldProps extends TextInputProps {
  label?: string;
  icon?: string;
}

export function Field({ label, icon, style, ...rest }: FieldProps & { style?: StyleProp<ViewStyle> }) {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? (
        <Text style={{ color: palette.text2, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            height: 44,
            paddingHorizontal: 14,
            backgroundColor: palette.input,
            borderColor: focused ? palette.brand : palette.border,
            borderWidth: 1,
            borderRadius: radii.sm,
          },
          style,
        ]}
      >
        {icon ? <CLIcon n={icon} size={20} color={palette.text3} style={{ marginRight: 8 }} /> : null}
        <TextInput
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={palette.text3}
          style={{ flex: 1, color: palette.text, fontSize: 14, padding: 0 }}
          {...rest}
        />
      </View>
    </View>
  );
}

// -------- BrandPanel --------------------------------------------------------

export function BrandPanel({ children }: { children?: ReactNode }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      {children}
    </View>
  );
}

// -------- Tiny shared styles ------------------------------------------------

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: radii.sm,
  },
});
