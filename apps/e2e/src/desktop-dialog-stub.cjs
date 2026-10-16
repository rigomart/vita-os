// Required into the desktop app's main process by the Playwright fixture (`electron --require
// <this> apps/desktop`), before main's own code runs: an error dialog or a message box is written
// out instead of shown, so a test run never leaves a native modal on screen. Main then goes on as
// it would after the person dismissed it: an error quits with code 1, and a message box answers
// with its cancel button (or its last), so nothing it offers, like opening a page, happens.
const { appendFileSync } = require("node:fs");
const { dialog } = require("electron");

function record(text) {
  process.stderr.write(`[vita dialog] ${text}`);
  if (process.env.VITA_TEST_DIALOG_LOG) {
    appendFileSync(process.env.VITA_TEST_DIALOG_LOG, text);
  }
}

dialog.showErrorBox = (title, content) => record(`${title}\n${content}\n`);

dialog.showMessageBox = async (...args) => {
  const options = args.at(-1);
  record(`${options.message}\n${options.detail ?? ""}\n`);
  const buttons = options.buttons ?? ["OK"];
  return {
    response: options.cancelId ?? buttons.length - 1,
    checkboxChecked: false,
  };
};
