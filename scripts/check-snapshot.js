import { runSnapshotValidator } from "../bin/snapshot-validator.js";
import { validateWorkflowSnapshot } from "../src/validation.js";

process.exitCode = runSnapshotValidator(validateWorkflowSnapshot);
