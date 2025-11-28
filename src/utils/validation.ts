import * as path from "path";
import { sessionStore } from "../services/session-store.js";

export const SESSION_ID_PATTERN = /^img_[a-zA-Z0-9_-]+$/;

export const INVALID_SESSION_ERROR =
  "Invalid or non-existent session ID. Please call create_session first to obtain a valid session ID.";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSessionId(sessionId: string): ValidationResult {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return { valid: false, error: INVALID_SESSION_ERROR };
  }

  if (!sessionStore.has(sessionId)) {
    return { valid: false, error: INVALID_SESSION_ERROR };
  }

  return { valid: true };
}

export interface PathValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAbsolutePath(filePath: string): PathValidationResult {
  if (!filePath || typeof filePath !== "string") {
    return { valid: false, error: "Path is required and must be a string" };
  }

  if (!path.isAbsolute(filePath)) {
    return {
      valid: false,
      error: `Path must be absolute. Received relative path: "${filePath}"`,
    };
  }

  return { valid: true };
}
