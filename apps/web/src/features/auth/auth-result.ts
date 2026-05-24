export function getAuthErrorMessage(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "error" in result &&
    result.error &&
    typeof result.error === "object" &&
    "message" in result.error &&
    typeof result.error.message === "string" &&
    result.error.message
  ) {
    return result.error.message;
  }

  return null;
}
