/**
 * Errors thrown by domain services and mapped by runAdminAction.
 * Pure module.
 */
export type ActionErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "NOT_FOUND"
  | "LIMIT"
  | "ERROR";

/** A rule violation with a user-facing message (optionally for one field). */
export class DomainError extends Error {
  constructor(
    readonly code: ActionErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const MAX_ACTIVE_EDITORS = 3;
export const EDITOR_LIMIT_MSG =
  "You can have at most 3 active editors. Deactivate one first.";

export class EditorLimitError extends DomainError {
  constructor() {
    super("LIMIT", EDITOR_LIMIT_MSG);
    this.name = "EditorLimitError";
  }
}
