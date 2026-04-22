import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { logError } from "../lib/errorLogger";
import { colors, radius } from "../theme";

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, { screen: "ErrorBoundary", metadata: { componentStack: info.componentStack ?? "" } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <Text style={s.title}>something went sideways</Text>
          <Text style={s.body}>an unexpected error occurred. tap below to try again.</Text>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={s.btnText}>try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: colors.teal,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.full,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
