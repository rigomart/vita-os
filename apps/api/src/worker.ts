import { createApp } from "./app";

const worker = {
  fetch(request: Request, env: Env) {
    return createApp(env).fetch(request, env);
  },
};

export default worker;
