import "dotenv/config";
import "./account-export.worker";
import "./conversation.worker";
import "./file-processing.worker";
import "./tool-execution.worker";

// eslint-disable-next-line no-console
console.info("[workers] started");
