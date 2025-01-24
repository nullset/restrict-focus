// @ts-nocheck

import "./src/index";
// window.restrictFocus = restrictFocus;

const template = document.createElement("template");
template.innerHTML = `
  <button>Start: Web component button</button>
  <slot></slot>
  <button>End: Web component button</button>
`;
class WebComponentElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.shadowRoot?.appendChild(template.content.cloneNode(true));
  }
}

if (!window.customElements.get("web-component-element")) {
  window.customElements.define("web-component-element", WebComponentElement);
}

window.addEventListener("restrict-focus:added", (e) => {
  e.detail.element.style.boxShadow = "0 0 0 3px lime";
});
window.addEventListener("restrict-focus:removed", (e) => {
  e.detail.element.style.boxShadow = "";
});

const registeredHotKeys = new Map();
window.registeredHotkeys = registeredHotKeys;

function sortObject(obj) {
  return Object.keys(obj)
    .sort()
    .reduce(function (result, key) {
      result[key] = obj[key];
      return result;
    }, {});
}
class AhaHotkeyElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = `<script><slot></slot></script>`;

    const fnStr = this.childNodes[0].textContent.trim();
    this.fn = /^function|^\(\) =>/.test(fnStr)
      ? new Function(`return ${fnStr}`).bind(this)()
      : new Function(fnStr).bind(this);
    // this.fn = new Function(`return ${fnStr}`)();
    // const fn = new Function(fnStr);
    // debugger;
    // this.shadowRoot.appendChild(template.content.cloneNode(true));

    const meta = this.hasAttribute("meta");
    const ctrl = this.hasAttribute("ctrl");
    const alt = this.hasAttribute("alt");
    const shift = this.hasAttribute("shift");
    const key = this.getAttribute("key");

    this.complex = JSON.stringify(sortObject({ meta, ctrl, alt, shift, key }));
    this.symbol = Symbol();

    if (registeredHotKeys.has(this.complex)) {
      const map = registeredHotKeys.get(this.complex);
      map.set(this, "alert(1)");
      registeredHotKeys.set(this.complex, map);
    } else {
      const map = new WeakMap();
      map.set(this, "alert()");
      registeredHotKeys.set(this.complex, map);
    }
  }
}
if (!window.customElements.get("aha-hotkey")) {
  window.customElements.define("aha-hotkey", AhaHotkeyElement);
}

window.addEventListener("keyup", (e) => {
  if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) return;

  const key = e.key.trim() || e.code;
  const complex = JSON.stringify(
    sortObject({
      meta: true,
      ctrl: true,
      alt: true,
      shift: true,
      key,
    })
  );

  const actions = registeredHotKeys.get(complex);
  if (actions) {
    // debugger;
    let hotkeyElement;
    const allNodes = Array.from(getAllElements(restrictFocus.activeElement));
    while (!hotkeyElement && allNodes.length) {
      const node = allNodes.pop();
      if (actions.has(node)) {
        hotkeyElement = node;
      }
    }
    if (hotkeyElement) {
      var link = hotkeyElement.getAttribute("link");
      if (link) {
        fetch(link);
      } else if (hotkeyElement.fn) {
        hotkeyElement.fn();
      }
    }
  }
});

document.querySelectorAll("button.toggleFocus").forEach((button) => {
  button.addEventListener("click", (e) => {
    const section = e.target.closest("div[id]");
    debugger;
    if (restrictFocus?.activeElement === section) {
      restrictFocus.remove(section);
    } else {
      restrictFocus.add(section);
    }
  });
});

const timeout = 2000;
setTimeout(() => {
  restrictFocus.add(document.getElementById("plain-div"));
  // restrictFocus.add(document.getElementById("third"));

  setTimeout(() => {
    restrictFocus.add(document.getElementById("second"), {
      // Re-enable to test piercing the restriction via some event.
      allowedEvents: ["mousedown", "mouseup", "click"],
    });

    document.getElementById("third-thing")?.remove();

    setTimeout(() => {
      restrictFocus.remove(document.getElementById("second"));
    }, timeout);
  }, timeout);
}, timeout);
