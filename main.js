import restrictFocus from "./src/index";

document.addEventListener("restrict-focus:added", (e) => {
  e.detail.style.borderWidth = "3px";
  e.detail.style.borderStyle = "double";
  e.detail.style.borderColor = "lime";
});
restrictFocus.add(document.getElementById("second"));
