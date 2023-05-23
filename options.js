const selectors = {
  chessName: document.querySelector("#chessName"),
  removeTags: document.querySelector("#removeTags"),
};

const saveOptions = () => {
  browser.storage.sync.set({
    chessName: selectors.chessName.value,
    removeTags: selectors.removeTags.checked,
  });
};

const restoreOptions = async () => {
  const res = await browser.storage.sync.get(["chessName", "removeTags"]);
  selectors.chessName.value = res.chessName || "";
  selectors.removeTags.checked = res.removeTags || false;
};

document.addEventListener("DOMContentLoaded", restoreOptions);
selectors.chessName.addEventListener("input", saveOptions);
selectors.removeTags.addEventListener("change", saveOptions);

// wait 100 ms to prevent css transitions while loading page
window.onload = () =>
  setTimeout(() => document.body.classList.remove("preload"), 100);
