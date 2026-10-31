import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import { getSoundEnabled, playTone, setSoundEnabled } from "../utils/sound";

const PUZZLE_SECONDS = 30;
const MAX_LIVES = 3;

const newRunId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const Game = () => {
  const navigate = useNavigate();

  const [puzzle, setPuzzle] = useState(null);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("playing"); // playing | over
  const [paused, setPaused] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [savedBest, setSavedBest] = useState(null);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(PUZZLE_SECONDS);
  const [soundOn, setSoundOn] = useState(getSoundEnabled);

  const nextTimer = useRef(null);
  // One id per play-through, generated synchronously so an in-flight save from
  // the previous run can never leak into the next one.
  const activeRunId = useRef(newRunId());
  const timeLeftRef = useRef(PUZZLE_SECONDS);
  const resolvingRef = useRef(false);
  const timeoutHandler = useRef(() => {});

  const secondsLeft = Math.ceil(timeLeft);
  const timerPercent = Math.max(
    0,
    Math.min(100, (timeLeft / PUZZLE_SECONDS) * 100)
  );
  const dialogOpen = quitOpen || restartOpen;
  const frozen = paused || dialogOpen;

  /* ------------------------------------------------------------------ puzzle */

  const fetchQuestion = useCallback(async () => {
    clearTimeout(nextTimer.current);
    resolvingRef.current = false;

    setLoading(true);
    setError("");
    setFeedback(null);
    setAnswer("");
    setBusy(false);

    try {
      const { data } = await api.get("/game/question");
      setPuzzle(data);

      // 🍌 Debug helper: print the correct answer to the browser console.
      if (data.solution !== undefined) {
        console.log("🍌 [BrainRoyale] Correct answer:", data.solution);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load a puzzle. Check that the backend is running."
      );
      setPuzzle(null);
    } finally {
      timeLeftRef.current = PUZZLE_SECONDS;
      setTimeLeft(PUZZLE_SECONDS);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestion();
    return () => clearTimeout(nextTimer.current);
  }, [fetchQuestion]);

  /* ------------------------------------------------------------------ saving */

  // Persists the run. Every save of the same runId updates the same score row.
  const saveScore = useCallback(async (value) => {
    if (!Number.isInteger(value) || value <= 0) return null;

    try {
      const { data } = await api.post("/game/score", {
        score: value,
        runId: activeRunId.current,
      });
      setSavedBest(data.bestScore);
      return data.bestScore;
    } catch (err) {
      console.error("Could not save score:", err);
      return null;
    }
  }, []);

  const endRun = useCallback(
    async (finalScore) => {
      clearTimeout(nextTimer.current);
      setPhase("over");
      setPaused(false);
      setQuitOpen(false);
      setRestartOpen(false);
      setBusy(false);
      await saveScore(finalScore);
    },
    [saveScore]
  );

  /* ------------------------------------------------------------------- timer */

  /**
   * A miss (wrong answer or timeout) costs one life. At zero lives the run ends;
   * otherwise the next puzzle loads after a short pause so the player can read
   * the correct answer.
   */
  const loseLife = async (message) => {
    if (phase !== "playing") return;

    const remainingLives = Math.max(0, lives - 1);

    setLives(remainingLives);
    setStreak(0);
    setAttempts((value) => value + 1);
    setBusy(true);
    setFeedback({ type: "bad", text: message });
    playTone("wrong");

    if (remainingLives === 0) {
      await endRun(score);
    } else {
      nextTimer.current = setTimeout(fetchQuestion, 1600);
    }
  };

  const handleTimeout = async () => {
    if (phase !== "playing" || resolvingRef.current || paused) return;
    resolvingRef.current = true;
    await loseLife("⏰ Time's up! Moving on to the next puzzle.");
  };
  timeoutHandler.current = handleTimeout;

  // Countdown. Recomputes a deadline whenever it restarts (new puzzle / resume),
  // so pausing really freezes the clock instead of just hiding the number.
  useEffect(() => {
    if (phase !== "playing" || frozen || busy || loading || !puzzle) {
      return undefined;
    }

    const deadline = Date.now() + timeLeftRef.current * 1000;

    const interval = setInterval(() => {
      const remaining = Math.max(0, (deadline - Date.now()) / 1000);
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        timeoutHandler.current();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase, frozen, busy, loading, puzzle]);

  // A soft tick during the last five seconds.
  useEffect(() => {
    if (phase !== "playing" || frozen || loading || busy) return;
    if (secondsLeft > 0 && secondsLeft <= 5) playTone("tick");
  }, [secondsLeft, phase, frozen, loading, busy]);

  /* ------------------------------------------------------------------ actions */

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!puzzle || busy || phase !== "playing" || frozen) return;

    const numeric = Number(answer);
    if (!answer.trim() || !Number.isInteger(numeric)) {
      setFeedback({ type: "bad", text: "Enter a whole number first." });
      return;
    }

    clearTimeout(nextTimer.current);
    resolvingRef.current = true;
    setBusy(true);

    try {
      const { data } = await api.post("/game/answer", {
        questionId: puzzle.questionId,
        answer: numeric,
      });

      if (data.correct) {
        const nextScore = score + 1;
        const nextStreak = streak + 1;

        setScore(nextScore);
        setStreak(nextStreak);
        setBestStreak((value) => Math.max(value, nextStreak));
        setAttempts((value) => value + 1);
        setFeedback({
          type: "ok",
          text:
            nextStreak >= 3
              ? `🔥 ${nextStreak} in a row! Keep going.`
              : "Correct! Next puzzle incoming…",
        });
        playTone("correct");

        saveScore(nextScore); // persist right away so the leaderboard updates
        resolvingRef.current = false;
        setBusy(false);
        nextTimer.current = setTimeout(fetchQuestion, 800);
      } else {
        await loseLife(`Not quite — the answer was ${data.solution}.`);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 410) {
        setFeedback({
          type: "bad",
          text: "That puzzle expired. Loading a new one…",
        });
        resolvingRef.current = false;
        setBusy(false);
        nextTimer.current = setTimeout(fetchQuestion, 800);
      } else {
        setFeedback({ type: "bad", text: message || "Something went wrong." });
        resolvingRef.current = false;
        setBusy(false);
      }
    }
  };

  const resetRound = () => {
    clearTimeout(nextTimer.current);
    activeRunId.current = newRunId(); // fresh run -> separate leaderboard entry

    resolvingRef.current = false;
    setScore(0);
    setLives(MAX_LIVES);
    setStreak(0);
    setBestStreak(0);
    setAttempts(0);
    setSavedBest(null);
    setFeedback(null);
    setPaused(false);
    setQuitOpen(false);
    setRestartOpen(false);
    setPhase("playing");

    fetchQuestion();
  };

  const requestRestart = () => {
    if (score > 0) setRestartOpen(true);
    else resetRound();
  };

  const confirmRestart = async () => {
    await saveScore(score);
    resetRound();
  };

  const confirmQuit = async () => {
    await saveScore(score);
    navigate("/dashboard", { replace: true });
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playTone("correct");
  };

  /* -------------------------------------------------------------- shortcuts */

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (event.key === "Escape") {
        if (paused) setPaused(false);
        return;
      }

      if (event.key.toLowerCase() === "p") {
        if (phase === "playing" && !dialogOpen) {
          setPaused((value) => !value);
        }
        return;
      }

      if (phase !== "playing" || frozen) return;

      if (/^[0-9]$/.test(event.key)) {
        setAnswer((current) => (current.length < 4 ? current + event.key : current));
      } else if (event.key === "Backspace") {
        setAnswer((current) => current.slice(0, -1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, paused, dialogOpen, frozen]);

  /* ---------------------------------------------------------------- render */

  if (phase === "over") {
    const accuracy = attempts > 0 ? Math.round((score / attempts) * 100) : 0;

    return (
      <div className="page page--narrow">
        <div className="card game-over">
          <div className="game-over__emoji">{score > 0 ? "🍌" : "🙈"}</div>
          <h1>Round over!</h1>
          <p className="muted">
            You solved {score} puzzle{score === 1 ? "" : "s"}.
          </p>
          <div className="big-score">{score}</div>

          <div className="result-grid">
            <div className="mini-stat">
              <span className="stat__label">Best streak</span>
              <strong>🔥 {bestStreak}</strong>
            </div>
            <div className="mini-stat">
              <span className="stat__label">Accuracy</span>
              <strong>{accuracy}%</strong>
            </div>
            <div className="mini-stat">
              <span className="stat__label">Personal best</span>
              <strong>{savedBest ?? "—"}</strong>
            </div>
          </div>

          <div
            className="hero__actions"
            style={{ justifyContent: "center", marginTop: 18 }}
          >
            <button className="btn btn--primary" onClick={resetRound}>
              ↻ Retry
            </button>
            <Link to="/leaderboard" className="btn btn--ghost">
              Leaderboard
            </Link>
            <Link to="/dashboard" className="btn btn--ghost">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <div className="game-head">
        <div>
          <h1 style={{ margin: 0 }}>Banana Puzzle</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Solve the equation in the image. A wrong answer or the timer running
            out costs a life.
          </p>
        </div>

        <div className="game-tools">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title="Toggle sound effects"
          >
            {soundOn ? "🔊 Sound" : "🔇 Muted"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setPaused((value) => !value)}
            disabled={dialogOpen || phase !== "playing"}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={requestRestart}
            disabled={busy && !paused}
          >
            ↻ Retry
          </button>
          <button
            type="button"
            className="btn btn--danger btn--small"
            onClick={() => setQuitOpen(true)}
          >
            ✕ Quit
          </button>
        </div>
      </div>

      <div className="game-hud">
        <div className="hud-stat">
          <span className="stat__label">Score</span>
          <strong>{score}</strong>
        </div>
        <div className="hud-stat">
          <span className="stat__label">Lives</span>
          <strong aria-label={`${lives} of ${MAX_LIVES} lives left`}>
            {"❤️".repeat(lives)}
            {"🤍".repeat(MAX_LIVES - lives)}
          </strong>
        </div>
        <div className="hud-stat">
          <span className="stat__label">Streak</span>
          <strong>{streak > 0 ? `🔥 ${streak}` : "—"}</strong>
        </div>
        <div className="hud-stat">
          <span className="stat__label">Time</span>
          <strong className={secondsLeft <= 5 ? "hud-danger" : ""}>
            {secondsLeft}s
          </strong>
        </div>
      </div>

      <div
        className={`timer-bar ${secondsLeft <= 5 ? "timer-bar--danger" : ""}`}
        role="progressbar"
        aria-label="Time left for this puzzle"
        aria-valuemin={0}
        aria-valuemax={PUZZLE_SECONDS}
        aria-valuenow={secondsLeft}
      >
        <span style={{ width: `${timerPercent}%` }} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="puzzle-card">
        {paused && !dialogOpen && (
          <div className="pause-overlay">
            <span className="pause-overlay__emoji" aria-hidden="true">
              ⏸
            </span>
            <h2>Paused</h2>
            <p className="muted">The timer is frozen. Take your time.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setPaused(false)}
            >
              ▶ Resume
            </button>
          </div>
        )}

        {loading && <p className="muted">Loading a fresh puzzle…</p>}

        {!loading && puzzle && (
          <>
            <img src={puzzle.question} alt="Banana puzzle equation" />

            <form onSubmit={handleSubmit}>
              <div className="answer-row">
                <input
                  type="number"
                  inputMode="numeric"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="?"
                  aria-label="Your answer"
                  disabled={busy || frozen}
                />
                <button
                  className="btn btn--dark"
                  type="submit"
                  disabled={busy || frozen}
                >
                  {busy ? "Checking…" : "Submit"}
                </button>
              </div>

              <p className="keyboard-hint muted">
                Tip: type the digits, press <kbd>Enter</kbd> to submit and{" "}
                <kbd>P</kbd> to pause.
              </p>
            </form>
          </>
        )}

        {!loading && !puzzle && !error && (
          <div className="empty-state">
            <span className="empty-state__emoji">🤔</span>
            No puzzle loaded.
            <div style={{ marginTop: 12 }}>
              <button className="btn btn--primary" onClick={fetchQuestion}>
                Try again
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <p className={`feedback feedback--${feedback.type}`}>{feedback.text}</p>
        )}
      </div>

      <ConfirmDialog
        open={quitOpen}
        title="Quit this round?"
        confirmLabel="Save & quit"
        danger
        onConfirm={confirmQuit}
        onCancel={() => setQuitOpen(false)}
      >
        <p className="muted">
          Your score of <strong>{score}</strong> will be saved to the leaderboard.
          You can start a new run whenever you like.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={restartOpen}
        title="Retry this round?"
        confirmLabel="Save & retry"
        onConfirm={confirmRestart}
        onCancel={() => setRestartOpen(false)}
      >
        <p className="muted">
          Your current score of <strong>{score}</strong> will be saved, then a
          fresh round starts with three lives.
        </p>
      </ConfirmDialog>
    </div>
  );
};

export default Game;
