/**
 * End-to-end API test suite.
 *
 * Run against a server started with NODE_ENV=test:  npm run test:api
 *
 * Authentication is cookie-based, so this suite keeps a tiny "cookie jar":
 * every request replays the `br_session` cookie returned by the server.
 */
const BASE = process.env.API_URL || "http://localhost:5001";

let cookie = ""; // primary session used by most tests
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

/** Turns ["br_session=abc; Path=/; HttpOnly"] into "br_session=abc". */
function sessionCookie(setCookies = []) {
  const raw = setCookies.find((c) => c.startsWith("br_session="));
  return raw ? raw.split(";")[0] : "";
}

function hasMaxAge(setCookies = []) {
  const raw = setCookies.find((c) => c.startsWith("br_session=")) || "";
  return /max-age=/i.test(raw) || /expires=/i.test(raw);
}

/**
 * Minimal HTTP helper.
 * - `useCookie: false` ignores the jar (used for "not signed in" checks)
 * - `cookieOverride` sends an explicit cookie value (used for a second device)
 */
async function call(
  method,
  path,
  { body, useCookie = true, cookieOverride } = {}
) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";

  const jar = cookieOverride !== undefined ? cookieOverride : useCookie ? cookie : "";
  if (jar) headers.Cookie = jar;

  // All endpoints below are documented without the "/api" prefix.
  const res = await fetch(`${BASE}/api${path}`, {
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

  return {
    status: res.status,
    data,
    setCookies: res.headers.getSetCookie ? res.headers.getSetCookie() : [],
  };
}

/** The CAPTCHA is a small arithmetic question, e.g. "What is 7 + 3?". */
function solveCaptcha(question = "") {
  const match = /What is (\d+) ([+−-]) (\d+)\?/.exec(question);
  if (!match) return NaN;
  const [, a, operator, b] = match;
  return operator === "+" ? Number(a) + Number(b) : Number(a) - Number(b);
}

async function freshCaptcha() {
  const { data } = await call("GET", "/auth/captcha", { useCookie: false });
  return { ...data, answer: solveCaptcha(data.question) };
}

async function loginAs(email, password, remember = false) {
  const captcha = await freshCaptcha();
  return call("POST", "/auth/login", {
    useCookie: false,
    body: {
      email,
      password,
      remember,
      captchaId: captcha.captchaId,
      captchaAnswer: captcha.answer,
    },
  });
}

const stamp = Date.now();
const user = {
  username: `tester_${stamp}`.slice(0, 30),
  email: `tester_${stamp}@example.com`,
  password: "secret123",
};
const newPassword = "secret456";

async function main() {
  console.log(`\nBrainRoyale API tests -> ${BASE}\n`);

  console.log("Health");
  const root = await fetch(`${BASE}/`).then(async (res) => ({
    status: res.status,
    data: await res.json().catch(() => null),
  }));
  check("GET / returns API info", root.status === 200 && !!root.data?.message);

  const health = await call("GET", "/health");
  check(
    "GET /api/health is ok",
    health.status === 200 && health.data?.status === "ok",
    JSON.stringify(health.data)
  );

  console.log("\nCAPTCHA");
  const captcha = await freshCaptcha();
  check(
    "captcha returns a challenge",
    !!captcha.captchaId && /What is/.test(captcha.question || "")
  );

  const badCaptcha = await call("POST", "/auth/login", {
    useCookie: false,
    body: {
      email: user.email,
      password: user.password,
      captchaId: captcha.captchaId,
      captchaAnswer: "not-a-number",
    },
  });
  check(
    "login rejects a wrong captcha",
    badCaptcha.status === 400 && badCaptcha.data?.code === "CAPTCHA_INVALID",
    JSON.stringify(badCaptcha.data)
  );

  const reusedCaptcha = await call("POST", "/auth/login", {
    useCookie: false,
    body: {
      email: user.email,
      password: user.password,
      captchaId: captcha.captchaId,
      captchaAnswer: captcha.answer,
    },
  });
  check(
    "a captcha cannot be reused",
    reusedCaptcha.status === 400 && reusedCaptcha.data?.code === "CAPTCHA_INVALID"
  );

  console.log("\nRegistration");
  const badRegister = await call("POST", "/auth/register", {
    useCookie: false,
    body: { username: "ab", email: "not-an-email", password: "123" },
  });
  check("register rejects invalid input", badRegister.status === 400);

  const weakPassword = await call("POST", "/auth/register", {
    useCookie: false,
    body: {
      username: `weak_${stamp}`.slice(0, 30),
      email: `weak_${stamp}@example.com`,
      password: "password",
    },
  });
  check(
    "register enforces the password policy",
    weakPassword.status === 400,
    JSON.stringify(weakPassword.data)
  );

  const register = await call("POST", "/auth/register", {
    useCookie: false,
    body: user,
  });
  check(
    "register creates a user and a session",
    register.status === 201 &&
      register.data?.user?.username === user.username &&
      !!sessionCookie(register.setCookies),
    JSON.stringify(register.data)
  );

  const duplicate = await call("POST", "/auth/register", {
    useCookie: false,
    body: user,
  });
  check("register blocks duplicates", duplicate.status === 409);

  console.log("\nProfile & authentication");
  const me = await call("GET", "/auth/me");
  check("me requires a session", me.status === 401);

  const registerCookie = sessionCookie(register.setCookies);
  const meWithCookie = await call("GET", "/auth/me", {
    cookieOverride: registerCookie,
  });
  check(
    "session cookie authenticates /auth/me",
    meWithCookie.status === 200 &&
      meWithCookie.data?.user?.email === user.email &&
      meWithCookie.data?.session?.remember === false,
    JSON.stringify(meWithCookie.data)
  );

  const adminAsPlayer = await call("GET", "/auth/admin/users", {
    cookieOverride: registerCookie,
  });
  check(
    "authorization: players cannot use admin routes",
    adminAsPlayer.status === 403,
    JSON.stringify(adminAsPlayer.data)
  );

  console.log("\nLogin & Remember me");
  const wrongPassword = await loginAs(user.email, "wrong-password");
  check(
    "login rejects a wrong password",
    wrongPassword.status === 401 &&
      wrongPassword.data?.code === "INVALID_CREDENTIALS"
  );
  check(
    "failed login reports remaining attempts",
    Number(wrongPassword.data?.remainingAttempts) === 4,
    JSON.stringify(wrongPassword.data)
  );

  const shortSession = await loginAs(user.email, user.password, false);
  check(
    "login without 'remember me' is a session cookie",
    shortSession.status === 200 && !hasMaxAge(shortSession.setCookies),
    shortSession.setCookies.join(" | ")
  );

  const remembered = await loginAs(user.email, user.password, true);
  cookie = sessionCookie(remembered.setCookies);
  check(
    "login with 'remember me' stores a persistent cookie",
    remembered.status === 200 && hasMaxAge(remembered.setCookies),
    remembered.setCookies.join(" | ")
  );

  console.log("\nSessions");
  const sessionList = await call("GET", "/auth/sessions");
  check(
    "sessions lists the signed-in devices",
    sessionList.status === 200 &&
      sessionList.data?.sessions?.length >= 2 &&
      sessionList.data.sessions.some((s) => s.current),
    JSON.stringify(sessionList.data)
  );

  const otherSession = sessionList.data.sessions.find((s) => !s.current);
  const shortCookie = sessionCookie(shortSession.setCookies);
  const revoke = await call("DELETE", `/auth/sessions/${otherSession.id}`);
  check("a device can be signed out remotely", revoke.status === 200);

  const revokedDevice = await call("GET", "/auth/me", {
    cookieOverride: shortCookie,
  });
  check(
    "a revoked session stops working",
    revokedDevice.status === 401,
    JSON.stringify(revokedDevice.data)
  );

  console.log("\nProfile updates");
  const updatedUsername = `${user.username}_x`.slice(0, 30);
  const update = await call("PATCH", "/auth/me", {
    body: { username: updatedUsername, email: user.email },
  });
  check(
    "profile update saves username/email",
    update.status === 200 && update.data?.user?.username === updatedUsername,
    JSON.stringify(update.data)
  );
  user.username = updatedUsername;

  const badUpdate = await call("PATCH", "/auth/me", {
    body: { username: "x", email: user.email },
  });
  check("profile update validates the username", badUpdate.status === 400);

  console.log("\nChange password");
  const weakChange = await call("POST", "/auth/change-password", {
    body: { currentPassword: user.password, newPassword: "short" },
  });
  check("change password enforces the policy", weakChange.status === 400);

  const wrongCurrent = await call("POST", "/auth/change-password", {
    body: {
      currentPassword: "not-my-password",
      newPassword,
      confirmPassword: newPassword,
    },
  });
  check("change password verifies the current password", wrongCurrent.status === 401);

  const changed = await call("POST", "/auth/change-password", {
    body: {
      currentPassword: user.password,
      newPassword,
      confirmPassword: newPassword,
    },
  });
  check(
    "change password succeeds",
    changed.status === 200,
    JSON.stringify(changed.data)
  );

  const oldPasswordLogin = await loginAs(user.email, user.password);
  check("the old password no longer works", oldPasswordLogin.status === 401);

  const newPasswordLogin = await loginAs(user.email, newPassword, true);
  check("the new password works", newPasswordLogin.status === 200);

  console.log("\nLogout");
  const logoutCookie = sessionCookie(newPasswordLogin.setCookies);
  const logout = await call("POST", "/auth/logout", {
    cookieOverride: logoutCookie,
  });
  check("logout succeeds", logout.status === 200);

  const afterLogout = await call("GET", "/auth/me", {
    cookieOverride: logoutCookie,
  });
  check("logout invalidates the session", afterLogout.status === 401);

  console.log("\nLogin attempt limitation");
  const lockUser = {
    username: `lock_${stamp}`.slice(0, 30),
    email: `lock_${stamp}@example.com`,
    password: "lockpass1",
  };
  const lockRegister = await call("POST", "/auth/register", {
    useCookie: false,
    body: lockUser,
  });
  check("lockout test account created", lockRegister.status === 201);

  let lastFailure = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    lastFailure = await loginAs(lockUser.email, "wrong-password");
  }
  check(
    "five wrong passwords are rejected",
    lastFailure.status === 401 && lastFailure.data?.remainingAttempts === 0,
    JSON.stringify(lastFailure.data)
  );

  const lockedOut = await loginAs(lockUser.email, lockUser.password);
  check(
    "the account is locked after five failures",
    lockedOut.status === 429 &&
      lockedOut.data?.code === "ACCOUNT_LOCKED" &&
      Number(lockedOut.data?.retryAfter) > 0,
    JSON.stringify(lockedOut.data)
  );

  const otherAccount = await loginAs(user.email, newPassword);
  check(
    "a locked account does not lock other accounts",
    otherAccount.status === 200,
    JSON.stringify(otherAccount.data)
  );

  console.log("\nGame");
  const question = await call("GET", "/game/question");
  check(
    "question returns image + id",
    question.status === 200 &&
      typeof question.data?.question === "string" &&
      !!question.data?.questionId,
    JSON.stringify(question.data)
  );

  const wrongAnswer = Number(question.data?.solution) === 0 ? 9 : 0;
  const wrong = await call("POST", "/game/answer", {
    body: { questionId: question.data?.questionId, answer: wrongAnswer },
  });
  check(
    "answer checks wrong guess",
    wrong.status === 200 && wrong.data?.correct === false,
    JSON.stringify(wrong.data)
  );

  const replay = await call("POST", "/game/answer", {
    body: { questionId: question.data?.questionId, answer: wrongAnswer },
  });
  check("answer rejects reused question", replay.status === 410);

  const second = await call("GET", "/game/question");
  const correct = await call("POST", "/game/answer", {
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

  const badAnswer = await call("POST", "/game/answer", {
    body: { questionId: "does-not-exist", answer: 3 },
  });
  check("answer rejects unknown question", badAnswer.status === 410);

  const scoreNoAuth = await call("POST", "/game/score", {
    useCookie: false,
    body: { score: 5 },
  });
  check("score requires a session", scoreNoAuth.status === 401);

  const badScore = await call("POST", "/game/score", { body: { score: -3 } });
  check("score validates range", badScore.status === 400);

  const score = await call("POST", "/game/score", { body: { score: 7 } });
  check(
    "score save starts a run",
    score.status === 201 &&
      typeof score.data?.runId === "string" &&
      score.data.runId.length >= 8 &&
      Number(score.data?.bestScore) === 7,
    JSON.stringify(score.data)
  );
  const runId = score.data?.runId;

  const sameRun = await call("POST", "/game/score", {
    body: { score: 9, runId },
  });
  check(
    "same run updates the existing row",
    sameRun.status === 201 && Number(sameRun.data?.bestScore) === 9,
    JSON.stringify(sameRun.data)
  );

  const lowerInRun = await call("POST", "/game/score", {
    body: { score: 4, runId },
  });
  check(
    "run score never decreases",
    lowerInRun.status === 201 && Number(lowerInRun.data?.bestScore) === 9,
    JSON.stringify(lowerInRun.data)
  );

  const meAfterRun = await call("GET", "/auth/me");
  check(
    "one run counts as one game",
    meAfterRun.data?.user?.games_played === 1 &&
      meAfterRun.data?.user?.best_score === 9,
    JSON.stringify(meAfterRun.data?.user)
  );

  const newRun = await call("POST", "/game/score", { body: { score: 12 } });
  check(
    "a save without runId starts a new run",
    newRun.status === 201 &&
      newRun.data?.runId !== runId &&
      Number(newRun.data?.bestScore) === 12,
    JSON.stringify(newRun.data)
  );

  const meAfterTwoRuns = await call("GET", "/auth/me");
  check(
    "second run increments games_played",
    meAfterTwoRuns.data?.user?.games_played === 2 &&
      meAfterTwoRuns.data?.user?.best_score === 12,
    JSON.stringify(meAfterTwoRuns.data?.user)
  );

  const leaderboard = await call("GET", "/game/leaderboard");
  const row = leaderboard.data?.leaderboard?.find(
    (p) => p.username === user.username
  );
  check(
    "leaderboard lists the player",
    leaderboard.status === 200 &&
      Array.isArray(leaderboard.data?.leaderboard) &&
      row?.maxScore === 12 &&
      row?.gamesPlayed === 2,
    JSON.stringify(leaderboard.data)
  );

  const stats = await call("GET", "/game/stats");
  check(
    "stats returns counters",
    stats.status === 200 &&
      stats.data?.totalPlayers >= 1 &&
      stats.data?.totalGames >= 2,
    JSON.stringify(stats.data)
  );

  const notFound = await call("GET", "/nope");
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
