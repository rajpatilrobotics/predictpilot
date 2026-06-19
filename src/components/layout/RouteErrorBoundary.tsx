import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RouteErrorState } from '@/components/layout/RouteStates';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  onRecover: () => void;
  resetKey: string;
  routeTitle: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: unknown, _errorInfo: ErrorInfo) {
    // Keep route-load failures user-safe. Detailed telemetry can be added later through appLogger.
  }

  componentDidUpdate(previousProps: RouteErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <RouteErrorState
          message="PredictPilot could not load this route surface. Return to the dashboard and try again."
          onNavigate={this.props.onRecover}
          title={`Could not load ${this.props.routeTitle}`}
        />
      );
    }

    return this.props.children;
  }
}
