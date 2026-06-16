import {
	getToolReconciliationConfig,
	runToolReconciliationSafely,
} from "@/lib/tools/reconciliation";

const { intervalMs } = getToolReconciliationConfig();

void runToolReconciliationSafely();

const reconciliationTimer = setInterval(() => {
	void runToolReconciliationSafely();
}, intervalMs);

reconciliationTimer.unref();
