import { Component, type ErrorInfo, type ReactNode } from "react";
import { Text, View, Pressable } from "react-native";
import { Sentry } from "../lib/sentry";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so a thrown screen does not white-screen the app (M7). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack ?? undefined } },
    });
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center bg-canvas px-8">
          <Text className="text-center font-sans-bold text-heading-sm text-ink">Something went wrong</Text>
          <Text className="mt-2 text-center font-sans text-body text-muted">
            Wave hit an unexpected error. Try again, or restart the app if this keeps happening.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={this.reset}
            className="mt-6 rounded-pill bg-lime px-6 py-3"
          >
            <Text className="font-sans-semibold text-ui text-ink">Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
