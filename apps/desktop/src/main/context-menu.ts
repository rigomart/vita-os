import type { ContextMenuParams, MenuItemConstructorOptions } from "electron";

import { opensExternally } from "./links.ts";

export interface ContextMenuActions {
  replaceMisspelling(word: string): void;
  addToDictionary(word: string): void;
  openLink(url: string): void;
  copyLink(url: string): void;
}

type Params = Pick<
  ContextMenuParams,
  | "misspelledWord"
  | "dictionarySuggestions"
  | "isEditable"
  | "editFlags"
  | "selectionText"
  | "linkURL"
>;

/**
 * What right-click offers where it lands, as a Mac app's text does: spelling
 * on a misspelled word, the link's own actions on a link that may leave the
 * app, and editing or copying. Empty where there is nothing to offer.
 */
export function contextMenuTemplate(
  params: Params,
  actions: ContextMenuActions,
): MenuItemConstructorOptions[] {
  const groups: MenuItemConstructorOptions[][] = [];

  if (params.misspelledWord) {
    const word = params.misspelledWord;
    const suggestions = params.dictionarySuggestions.slice(0, 5);
    groups.push([
      ...(suggestions.length > 0
        ? suggestions.map((suggestion) => ({
            label: suggestion,
            click: () => actions.replaceMisspelling(suggestion),
          }))
        : [{ label: "No Guesses Found", enabled: false }]),
      { label: "Learn Spelling", click: () => actions.addToDictionary(word) },
    ]);
  }

  if (params.linkURL && opensExternally(params.linkURL)) {
    const url = params.linkURL;
    groups.push([
      { label: "Open Link", click: () => actions.openLink(url) },
      { label: "Copy Link", click: () => actions.copyLink(url) },
    ]);
  }

  if (params.isEditable) {
    groups.push([
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    ]);
  } else if (params.selectionText.trim()) {
    groups.push([{ role: "copy" }]);
  }

  return groups.flatMap((group, index) =>
    index === 0 ? group : [{ type: "separator" as const }, ...group],
  );
}
