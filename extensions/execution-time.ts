import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "execution-time";
const UPDATE_INTERVAL_MS = 250;

type TimerState = {
	startedAt: number;
	interval: ReturnType<typeof setInterval>;
};

export default function (pi: ExtensionAPI) {
	let timer: TimerState | undefined;

	function stopTimer() {
		if (!timer) return;
		clearInterval(timer.interval);
		timer = undefined;
	}

	function renderRunning(ctx: ExtensionContext) {
		if (!timer) return;
		const elapsedMs = Date.now() - timer.startedAt;
		const theme = getInitializedTheme(ctx);
		const icon = theme?.fg("accent", "⏱") ?? "⏱";
		const text = theme?.fg("dim", ` ${formatElapsed(elapsedMs)}`) ?? ` ${formatElapsed(elapsedMs)}`;
		ctx.ui.setStatus(STATUS_KEY, icon + text);
	}

	function renderDone(ctx: ExtensionContext, elapsedMs: number, completedAt: Date) {
		const theme = getInitializedTheme(ctx);
		const icon = theme?.fg("success", "✓") ?? "✓";
		const label = theme?.fg("dim", " task ") ?? " task ";
		const duration = theme?.fg("muted", formatElapsed(elapsedMs)) ?? formatElapsed(elapsedMs);
		const separator = theme?.fg("dim", " · ") ?? " · ";
		const completedTime = theme?.fg("muted", formatCompletedAt(completedAt)) ?? formatCompletedAt(completedAt);
		ctx.ui.setStatus(STATUS_KEY, icon + label + duration + separator + completedTime);
	}

	pi.on("agent_start", async (_event, ctx) => {
		stopTimer();

		if (!supportsFooterStatus(ctx)) return;

		timer = {
			startedAt: Date.now(),
			interval: setInterval(() => renderRunning(ctx), UPDATE_INTERVAL_MS),
		};

		renderRunning(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!timer) return;

		const completedAt = new Date();
		const elapsedMs = completedAt.getTime() - timer.startedAt;
		stopTimer();
		if (supportsFooterStatus(ctx)) renderDone(ctx, elapsedMs, completedAt);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		stopTimer();
		if (supportsFooterStatus(ctx)) ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}

function supportsFooterStatus(ctx: ExtensionContext) {
	const mode = getContextMode(ctx);
	return ctx.hasUI && (mode === "tui" || mode === "rpc");
}

function getInitializedTheme(ctx: ExtensionContext) {
	if (getContextMode(ctx) !== "tui") return undefined;

	try {
		return ctx.ui.theme;
	} catch {
		return undefined;
	}
}

function getContextMode(ctx: ExtensionContext) {
	return (ctx as ExtensionContext & { mode?: string }).mode;
}

function formatElapsed(ms: number) {
	const totalSeconds = Math.max(0, ms / 1000);

	if (totalSeconds < 10) {
		return `${totalSeconds.toFixed(1)}s`;
	}

	const roundedSeconds = Math.floor(totalSeconds);
	const seconds = roundedSeconds % 60;
	const totalMinutes = Math.floor(roundedSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);

	if (hours > 0) {
		return `${hours}h ${pad2(minutes)}m ${pad2(seconds)}s`;
	}

	if (minutes > 0) {
		return `${minutes}m ${pad2(seconds)}s`;
	}

	return `${roundedSeconds}s`;
}

function formatCompletedAt(date: Date) {
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function pad2(value: number) {
	return value.toString().padStart(2, "0");
}
