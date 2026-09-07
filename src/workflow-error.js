export class WorkflowDAGError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "WorkflowDAGError";
    this.code = code;
    this.recoverable = options.recoverable === true;
    if (options.cause !== undefined && this.cause === undefined) {
      this.cause = options.cause;
    }
  }
}
