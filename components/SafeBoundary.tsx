import { Component, type ReactNode } from "react";

import { logFatalError } from "@/utils/errorLogging";

type Props = {
	/** Label included in logs to identify which subsystem failed. */
	name: string;
	children: ReactNode;
	/**
	 * What to render if the children throw. Defaults to `null` — correct for
	 * non-visual bootstrap components, whose failure must never take down the app.
	 */
	fallback?: ReactNode;
};

type State = { hasError: boolean };

/**
 * Isolating error boundary for non-critical subsystems (bootstrap side-effect
 * components, toasts). A synchronous render/mount throw in a wrapped child is
 * caught and logged, and the rest of the app keeps running instead of crashing
 * at startup. Async errors inside the children's effects are not caught here —
 * those are handled by each component's own try/catch and the global handler.
 */
export default class SafeBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: unknown) {
		logFatalError(error, "render", this.props.name);
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback ?? null;
		}
		return this.props.children;
	}
}
