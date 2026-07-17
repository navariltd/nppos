/**
 * parse-error – utility for extracting human-readable error messages from Frappe API responses.
 */

/** Extract a readable error message from a Frappe SDK error object. */
export function parseFrappeError(err: any): string {
  if (err?._server_messages) {
    try {
      const messages = JSON.parse(err._server_messages);
      if (Array.isArray(messages) && messages.length > 0) {
        const first = typeof messages[0] === "string" ? JSON.parse(messages[0]) : messages[0];
        return first?.message || first?.title || err?.message || "An error occurred";
      }
    } catch {
      // Fall through to other checks
    }
  }
  if (err?.messages && Array.isArray(err.messages) && err.messages.length > 0) {
    return err.messages[0];
  }
  if (err?.exception) return err.exception;
  if (err?.message) return err.message;
  return "An error occurred";
}