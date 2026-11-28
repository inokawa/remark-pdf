// TRE parses html with htmlparser2, but remark-pdf builds TRE's tree from a
// DOM it makes of hast, so the parser and the entities it decodes are left
// out of the bundle for this.
export class Parser {
  constructor() {
    throw new Error("remark-pdf doesn't parse html");
  }
}
