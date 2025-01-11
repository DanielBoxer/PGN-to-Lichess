const selectors = {
  chessName: document.querySelector("#chessName"),
  removeTags: document.querySelector("#removeTags"),
  preventInvalid: document.querySelector("#preventInvalid"),
  displayNotifs: document.querySelector("#displayNotifs"),
};

const saveOptions = () => {
  browser.storage.sync.set({
    chessName: selectors.chessName.value,
    removeTags: selectors.removeTags.checked,
    preventInvalid: selectors.preventInvalid.checked,
    displayNotifs: selectors.displayNotifs.checked,
  });
};

const restoreOptions = async () => {
  const res = await browser.storage.sync.get([
    "chessName",
    "removeTags",
    "preventInvalid",
    "displayNotifs",
  ]);
  selectors.chessName.value = res.chessName || "";
  selectors.removeTags.checked = res.removeTags || false;
  selectors.preventInvalid.checked = res.preventInvalid || false;
  selectors.displayNotifs.checked = res.displayNotifs || false;

  setDisabledPreventInvalid(!selectors.displayNotifs.checked);
};

const setDisabledPreventInvalid = (shouldDisable) => {
  selectors.preventInvalid.disabled = shouldDisable;
  if (shouldDisable) {
    // uncheck when disabled
    selectors.preventInvalid.checked = false;
  }
};

const requestPermission = async () => {
  try {
    const permission = await browser.permissions.request({
      permissions: ["notifications"],
    });
    if (!permission) {
      // uncheck if permission denied
      selectors.displayNotifs.checked = false;
      setDisabledPreventInvalid(true);
    }
  } catch (error) {
    console.error("Error requesting notifications permission: ", error);
  }
};

document.addEventListener("DOMContentLoaded", restoreOptions);
selectors.chessName.addEventListener("input", saveOptions);
selectors.removeTags.addEventListener("change", saveOptions);
selectors.preventInvalid.addEventListener("change", saveOptions);
selectors.displayNotifs.addEventListener("change", (event) => {
  if (event.target.checked) {
    requestPermission();
  }
  setDisabledPreventInvalid(!event.target.checked);
  saveOptions();
});

// listener for when the user revokes permission after enabling notifications
browser.permissions.onRemoved.addListener((permissions) => {
  if (permissions.permissions.includes("notifications")) {
    selectors.displayNotifs.checked = false;
    setDisabledPreventInvalid(true);
    saveOptions();
  }
});

// wait 100 ms to prevent css transitions while loading page
window.onload = () =>
  setTimeout(() => document.body.classList.remove("preload"), 100);
