let selectionInfo = {
  pgn: null,
  side: null,
  tabIdx: null,
};

const notifyUser = (id, message) => {
  browser.notifications.create(id, {
    type: "basic",
    iconUrl: browser.runtime.getURL("lichess.png"),
    title: "PGN to Lichess",
    message: message,
  });
};

const sendToLichess = async (pgn, side, tabIdx) => {
  const resp = await fetch("https://lichess.org/api/import", {
    method: "POST",
    body: new URLSearchParams({ pgn }),
  });
  if (!resp.ok) {
    notifyUser(
      "requestError",
      `Failed to import PGN to Lichess: ${resp.status} ${resp.statusText}`
    );
    return;
  }

  const data = await resp.json();
  await browser.tabs.create({
    url: `${data.url}/${side}`,
    index: tabIdx,
  });
};

const tagRegex = (tag) => {
  return new RegExp(`\\[${tag}\\s*".*"\\]`);
};

const removeTag = (pgn, tag) => {
  return pgn.replace(tagRegex(tag), "");
};

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "pgn-to-lichess") {
    let pgn = info.selectionText;

    // get options from storage
    const options = await browser.storage.sync.get(["chessName", "removeTags"]);
    const chessName = options.chessName || "";
    const removeTags = options.removeTags || false;

    if (removeTags) {
      const tags = [
        "Event",
        "Site",
        "Date",
        "Round",
        "Result",
        "TimeControl",
        "WhiteElo",
        "BlackElo",
      ];
      tags.forEach((tag) => (pgn = removeTag(pgn, tag)));
    }

    // remove all non letter chars from tag names
    pgn = pgn.replace(/\[(.*?)\s/g, function (_, match) {
      return "[" + match.replace(/[^a-zA-Z]/g, "") + " ";
    });

    // add unknown date tag if not found
    if (!tagRegex("Date").test(pgn)) {
      pgn = '[Date "????.??.??"]\n' + pgn;
    }

    // remove variations
    pgn = pgn.replace(/\(.*?\)/gs, "");

    let side = "white";
    // set side based on fen
    const fenMatch = pgn.match(/\[FEN\s"([^"]*)"\]/);
    if (fenMatch) {
      // setup tag means puzzle where you move second, side is opposite
      // otherwise use side in fen tag
      const isSetUp = /\[SetUp\s*"1"\]/.test(pgn);
      side = (fenMatch[1].split(" ")[1] === "w") ^ isSetUp ? "white" : "black";
    }

    // set side based on name
    const nameMatch = pgn.match(`\\[(White|Black)\\s*"${chessName}"\\]`);
    if (nameMatch) {
      side = nameMatch[1].toLowerCase();
    }

    // store data in case selection isn't like a pgn
    selectionInfo = {
      pgn: pgn,
      side: side,
      tabIdx: tab.index + 1,
    };

    // test if selection follows pgn format
    const tag = /\[\w+\s+"[^"]*"\]\s*/.source;
    const moveNum = /(\d+\.(\.\.)?)\s*/.source;
    const move = /[KQRBNxa-h1-8+#=O\-]{2,7}\s*/.source;
    const comment = /(\{.*?\}\s*)?/.source;
    const gameEnd = /((1-0|0-1|1\/2-1\/2|\*)\s*)?/.source;
    const pgnRegex = new RegExp(
      `^(${tag})*(((${moveNum}(${move}){1,2}${comment})*)${gameEnd})?$`
    );

    if (pgnRegex.test(pgn)) {
      await sendToLichess(pgn, side, tab.index + 1);
    } else {
      notifyUser(
        "notPGN",
        "Selection doesn't look like a PGN! Click here to open anyway."
      );
    }
  }
});

browser.notifications.onClicked.addListener(async (id) => {
  if (id === "notPGN") {
    await sendToLichess(
      selectionInfo.pgn,
      selectionInfo.side,
      selectionInfo.tabIdx
    );
  }
});

browser.menus.create({
  id: "pgn-to-lichess",
  title: "PGN to Lichess",
  contexts: ["selection"],
});
