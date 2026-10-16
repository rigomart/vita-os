// Required into the desktop app's main process by the Playwright fixture (`electron --require
// <this> apps/desktop`), before main's own code runs: an error dialog is written out instead of
// shown, so a test run never leaves a native modal on screen. Main then goes on as it would after
// the person dismissed it (it quits with code 1).
const { appendFileSync } = require("node:fs");
const { dialog } = require("electron");

dialog.showErrorBox = (title, content) => {
  const text = `${title}\n${content}\n`;
  process.stderr.write(`[vita dialog] ${text}`);
  if (process.env.VITA_TEST_DIALOG_LOG) {
    appendFileSync(process.env.VITA_TEST_DIALOG_LOG, text);
  }
};
