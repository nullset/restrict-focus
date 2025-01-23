interface Options {
  checkFocusable?: boolean;
  filterTagName?: string;
}

export function isFocusable(node: HTMLElement): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (!node.isConnected) return false;
  if (node.hasAttribute("disabled")) return false;
  if (node.inert) return false;
  if (node.tabIndex < 0) return false;
  if (node.hasAttribute("disabled")) return false;
  if (node.hasAttribute("inert")) return false;
  if (node instanceof HTMLLinkElement && !node.href) return false;

  const { width, height } = node.getBoundingClientRect();
  if (!width || !height) return false;

  return true;
}

export default class ShadowTreeWalker {
  private root: Element;
  private checkFocusable: boolean;
  private filterTagName: string;
  private elements: Set<HTMLElement>;

  constructor(
    root: Element,
    opts: Options = { checkFocusable: false, filterTagName: "" }
  ) {
    this.root = root;
    this.checkFocusable = opts.checkFocusable || false;
    this.filterTagName = (opts.filterTagName || "").toUpperCase();
    this.elements = new Set();
  }

  walk(): Set<HTMLElement> {
    this.walkNode(this.root);
    return this.elements;
  }

  private isValidNode(node: Element): boolean {
    let returnableSet = new Set([true]);
    if (this.filterTagName) {
      returnableSet.add(node.tagName === this.filterTagName);
    }
    if (this.checkFocusable) {
      returnableSet.add(isFocusable(node as HTMLElement));
    }

    return returnableSet.has(false) ? false : true;
  }

  private walkNode(node: Element | Node): void {
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedElements({ flatten: true });
      assigned.forEach((element) => {
        if (element instanceof HTMLElement && this.isValidNode(element)) {
          this.elements.add(element);
        }
        this.walkNode(element);
      });
    }

    if (node instanceof HTMLElement && this.isValidNode(node)) {
      this.elements.add(node);
    }

    if (node instanceof Element && node.shadowRoot) {
      this.walkChildren(node.shadowRoot);
    }

    this.walkChildren(node);
  }

  private walkChildren(node: Node): void {
    const children = node.childNodes;
    if (children) {
      Array.from(children).forEach((child) => this.walkNode(child));
    }
  }
}
