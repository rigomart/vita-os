/**
 * The seam React behavior is tested against.
 *
 * A host's own tests build situations by configuring this fake rather than by
 * standing up a transport, so a screen's test says what the application answers
 * and nothing about how it was fetched.
 */
export {
  createFakeApplicationClient,
  createQuietApplicationClient,
  deferred,
  failure,
  success,
} from "./fake-application-client";
