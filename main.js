import restrictFocus from "./src/index";

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

    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }
}

if (!window.customElements.get("web-component-element")) {
  window.customElements.define("web-component-element", WebComponentElement);
}

document.addEventListener("restrict-focus:added", (e) => {
  e.detail.style.borderWidth = "3px";
  e.detail.style.borderStyle = "double";
  e.detail.style.borderColor = "lime";
});
restrictFocus.add(document.getElementById("second"));
