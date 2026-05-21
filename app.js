const btn = document.getElementById("clickMe");
const output = document.getElementById("output");

let count = 0;
btn.addEventListener("click", () => {
  count += 1;
  output.textContent = `Clicked ${count} time${count === 1 ? "" : "s"}.`;
});
