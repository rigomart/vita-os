import { createApp } from "./app";

/** Built once per isolate; each request brings its own bindings. */
const app = createApp();

export default app;
