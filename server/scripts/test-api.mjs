/**
 * End-to-end API test suite.
 * Run against a server started with NODE_ENV=test:  npm run test:api
 */
const BASE = process.env.API_URL || "http://localhost:5000";

let token = "";
let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(`${name} ${detail}`);
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function call(method, path, { body, auth = false, tokenOverride } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const bearer = tokenOverride !== undefined ? tokenOverride : auth ? token : "";
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const stamp = Date.now();
const user = {
  username: `tester_${stamp}`.slice(0, 30),
  email: `tester_${stamp}@example.com`,
  password: "secret123",
};

async function main() {
  console.log(`\nBrainRoyale API tests -> ${BASE}\n`);

  console.log("Health");
  const root = await call("GET", "/");
  check("GET / returns API info", root.status === 200 && !!root.data?.message);

  const health = await call("GET", "/api/health");
  check(
    "GET /api/health is ok",
    health.status === 200 && health.data?.status === "ok",
    JSON.stringify(health.data)
  );

  console.log("\nAuth");
  const badRegister = await call("POST", "/api/auth/register", {
    body: { username: "ab", email: "not-an-email", password: "123" },
  });
  check("register rejects invalid input", badRegister.status === 400);

  const register = await call("POST", "/api/auth/register", { body: user });
  check(
    "register creates user",
    register.status === 201 && !!register.data?.token,
    JSON.stringify(register.data)
  );
  token = register.data?.token || "";

  const duplicate = await call("POST", "/api/auth/register", { body: user });
  check("register blocks duplicates", duplicate.status === 409);

  const badLogin = await call("POST", "/api/auth/login", {
    body: { email: user.email, password: "wrong-password" },
  });
  check("login rejects wrong password", badLogin.status === 401);

  const login = await call("POST", "/api/auth/login", {
    body: { email: user.email, password: user.password },
  });
  check(
    "login returns token",
    login.status === 200 && !!login.data?.token,
    JSON.stringify(login.data)
  );
  token = login.data?.token || token;

  const meNoAuth = await call("GET", "/api/auth/me");
  check("me requires auth", meNoAuth.status === 401);

  const meBadToken = await call("GET", "/api/auth/me", { tokenOverride: "bad.token.here" });
  check("me rejects invalid token", meBadToken.status === 401);

  const me = await call("GET", "/api/auth/me", { auth: true });
  check(
    "me returns profile",
    me.status === 200 && me.data?.user?.username === user.username,
    JSON.stringify(me.data)
  );

  console.log("\nGame");
  const question = await call("GET", "/api/game/question");
  check(
    "question returns image + id",
    question.status === 200 &&
      typeof question.data?.question === "string" &&
      !!question.data?.questionId,
    JSON.stringify(question.data)
  );

  const wrongAnswer =
    Number(question.data?.solution) === 0 ? 9 : 0;
  const wrong = await call("POST", "/api/game/answer", {
    body: { questionId: question.data?.questionId, answer: wrongAnswer },
  });
  check(
    "answer checks wrong guess",
    wrong.status === 200 && wrong.data?.correct === false,
    JSON.stringify(wrong.data)
  );

  const replay = await call("POST", "/api/game/answer", {
    body: { questionId: question.data?.questionId, answer: wrongAnswer },
  });
  check("answer rejects reused question", replay.status === 410);

  const second = await call("GET", "/api/game/question");
  const correct = await call("POST", "/api/game/answer", {
    body: {
      questionId: second.data?.questionId,
      answer: second.data?.solution,
    },
  });
  check(
    "answer accepts correct guess",
    correct.status === 200 && correct.data?.correct === true,
    JSON.stringify(correct.data)
  );

  const badAnswer = await call("POST", "/api/game/answer", {
    body: { questionId: "does-not-exist", answer: 3 },
  });
  check("answer rejects unknown question", badAnswer.status === 410);

  const scoreNoAuth = await call("POST", "/api/game/score", { body: { score: 5 } });
  check("score requires auth", scoreNoAuth.status === 401);

  const badScore = await call("POST", "/api/game/score", {
    body: { score: -3 },
    auth: true,
  });
  check("score validates range", badScore.status === 400);

  const score = await call("POST", "/api/game/score", {
    body: { score: 7 },
    auth: true,
  });
  check(
    "score save starts a run",
    score.status === 201 &&
      typeof score.data?.runId === "string" &&
      score.data.runId.length >= 8 &&
      Number(score.data?.bestScore) === 7,
    JSON.stringify(score.data)
  );
  const runId = score.data?.runId;

  const sameRun = await call("POST", "/api/game/score", {
    body: { score: 9, runId },
    auth: true,
  });
  check(
    "same run updates the existing row",
    sameRun.status === 201 && Number(sameRun.data?.bestScore) === 9,
    JSON.stringify(sameRun.data)
  );

  const lowerInRun = await call("POST", "/api/game/score", {
    body: { score: 4, runId },
    auth: true,
  });
  check(
    "run score never decreases",
    lowerInRun.status === 201 && Number(lowerInRun.data?.bestScore) === 9,
    JSON.stringify(lowerInRun.data)
  );

  const meAfterRun = await call("GET", "/api/auth/me", { auth: true });
  check(
    "one run counts as one game",
    meAfterRun.data?.user?.games_played === 1 &&
      meAfterRun.data?.user?.best_score === 9,
    JSON.stringify(meAfterRun.data?.user)
  );

  const newRun = await call("POST", "/api/game/score", {
    body: { score: 12 },
    auth: true,
  });
  check(
    "a save without runId starts a new run",
    newRun.status === 201 &&
      newRun.data?.runId !== runId &&
      Number(newRun.data?.bestScore) === 12,
    JSON.stringify(newRun.data)
  );

  const meAfterTwoRuns = await call("GET", "/api/auth/me", { auth: true });
  check(
    "second run increments games_played",
    meAfterTwoRuns.data?.user?.games_played === 2 &&
      meAfterTwoRuns.data?.user?.best_score === 12,
    JSON.stringify(meAfterTwoRuns.data?.user)
  );

  const leaderboard = await call("GET", "/api/game/leaderboard");
  const row = leaderboard.data?.leaderboard?.find((p) => p.username === user.username);
  check(
    "leaderboard lists the player",
    leaderboard.status === 200 &&
      Array.isArray(leaderboard.data?.leaderboard) &&
      row?.maxScore === 12 &&
      row?.gamesPlayed === 2,
    JSON.stringify(leaderboard.data)
  );

  const stats = await call("GET", "/api/game/stats");
  check(
    "stats returns counters",
    stats.status === 200 &&
      stats.data?.totalPlayers >= 1 &&
      stats.data?.totalGames >= 2,
    JSON.stringify(stats.data)
  );

  const notFound = await call("GET", "/api/nope");
  check("unknown route returns 404", notFound.status === 404);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("\nFailures:");
    failures.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
