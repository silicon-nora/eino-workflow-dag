#!/usr/bin/env node

import { validateWorkflowSnapshot } from "eino-workflow-dag/validation";
import { runSnapshotValidator } from "./snapshot-validator.js";

process.exitCode = runSnapshotValidator(validateWorkflowSnapshot);
