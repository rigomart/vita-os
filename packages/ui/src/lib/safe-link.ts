/** The links the product opens: web pages and email. Any other scheme is dropped. */
export function safeLink(url: string) {
  return /^(https?:|mailto:)/i.test(url) ? url : undefined;
}
