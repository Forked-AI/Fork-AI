export class ToolExecutionError extends Error {
	public readonly status: number;
	public readonly errorCode: string;

	constructor(
		message: string,
		options: { status: number; errorCode: string }
	) {
		super(message);
		this.name = "ToolExecutionError";
		this.status = options.status;
		this.errorCode = options.errorCode;
	}
}
