// Small input checks shared by the routes.
// Each check returns { value } when the input is OK, or { error } when not.

const MAX_TEXT_LENGTH = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    return { error: `${field} must be a non-empty text` };
  }
  if (value.trim().length > MAX_TEXT_LENGTH) {
    return { error: `${field} can be at most ${MAX_TEXT_LENGTH} characters` };
  }
  return { value: value.trim() };
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

module.exports = { checkText, isUuid };
