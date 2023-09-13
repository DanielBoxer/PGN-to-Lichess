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

const request = async (url, method, errMsg, body = null) => {
  // need to specify response format as json
  const options = {
    method,
    headers: { Accept: "application/json" },
  };
  if (body) {
    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = body;
  }

  try {
    const resp = await fetch(url, options);
    if (!resp.ok) {
      notifyUser(
        "requestError",
        `${errMsg}: ${resp.status} ${resp.statusText}`
      );
      return null;
    }

    const data = await resp.json();
    return data;
  } catch (error) {
    notifyUser("requestError", error.message);
    return null;
  }
};

const sendToLichess = async (pgn, side, tabIdx) => {
  const data = await request(
    "https://lichess.org/api/import",
    "POST",
    "Failed to import PGN to Lichess",
    new URLSearchParams({ pgn })
  );
  if (!data) {
    return;
  }

  await browser.tabs.create({
    url: `${data.url}/${side}`,
    index: tabIdx,
  });
};

const processPGN = async (pgn, tab) => {
  const options = await browser.storage.sync.get(["chessName", "removeTags"]);
  const chessName = options.chessName || "";
  const removeTags = options.removeTags || false;

  if (removeTags) {
    // remove all tags except for these ones
    const tags = new Set([
      "White",
      "Black",
      "Result",
      "Termination",
      "SetUp",
      "FEN",
    ]);
    pgn = pgn.replace(/\[(.*?)\s*".*"\]\r?\n?/g, (match, tagName) => {
      return tags.has(tagName) ? match : "";
    });
  }

  // remove all non letter chars from tag names
  pgn = pgn.replace(/\[(.*?)\s/g, function (_, match) {
    return "[" + match.replace(/[^a-zA-Z]/g, "") + " ";
  });

  // add unknown date tag if not found
  if (!/\[Date\s*".*"\]/.test(pgn)) {
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
};

const getRecentPGN = async () => {
  const options = await browser.storage.sync.get(["chessName"]);
  if (!options.chessName) {
    notifyUser(
      "noChessName",
      "Please specify your Chess.com username in the options."
    );
    return null;
  }

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = `${currentDate.getMonth() + 1}`.padStart(2, "0");
  const data = await request(
    `https://api.chess.com/pub/player/${options.chessName}/games/${year}/${month}`,
    "GET",
    `Failed to get ${options.chessName}'s Chess.com games`
  );
  if (!data) {
    return null;
  }

  if (!data.games.length) {
    notifyUser("noGames", "No recent games found.");
    return null;
  }

  return data.games[data.games.length - 1].pgn;
};

browser.menus.onClicked.addListener(async (info, tab) => {
  let pgn = null;
  if (info.menuItemId === "pgn-to-lichess") {
    pgn = info.selectionText;
  } else if (info.menuItemId === "chess-to-lichess") {
    pgn = await getRecentPGN();
  }

  if (pgn) {
    await processPGN(pgn, tab);
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

browser.menus.create({
  id: "chess-to-lichess",
  title: "Chess.com to Lichess",
  contexts: ["page"],
  documentUrlPatterns: ["*://www.chess.com/game/live/*"],
});
