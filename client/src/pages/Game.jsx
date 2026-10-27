import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const Game = () => {
  const [puzzle, setPuzzle] = useState(null);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("playing"); // playing | over
  const [savedBest, setSavedBest] = useState(null);
  const [error, setError] = useState("");
  const nextTimer = useRef(null);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setError("");
    setFeedback(null);
    setAnswer("");
    try {
      const { data } = await api.get("/game/question");
      setPuzzle(data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load a puzzle. Check that the backend is running."
      );
      setPuzzle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestion();
    return () => clearTimeout(nextTimer.current);
  }, [fetchQuestion]);

  const endGame = async (finalScore) => {
    setPhase("over");
    try {
      const { data } = await api.post("/game/score", { score: finalScore });
      setSavedBest(data.bestScore);
    } catch {
      setSavedBest(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!puzzle || busy || phase !== "playing") return;

    const numeric = Number(answer);
    if (!answer.trim() || !Number.isInteger(numeric)) {
      setFeedback({ type: "bad", text: "Enter a whole number first." });
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post("/game/answer", {
        questionId: puzzle.questionId,
        answer: numeric,
      });

      if (data.correct) {
        const nextScore = score + 1;
        setScore(nextScore);
        setFeedback({ type: "ok", text: "Correct! Next puzzle incoming…" });
        nextTimer.current = setTimeout(fetchQuestion, 900);
      } else {
        setFeedback({
          type: "bad",
          text: `Not quite — the answer was ${data.solution}.`,
        });
        await endGame(score);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 410) {
        setFeedback({ type: "bad", text: "That puzzle expired. Loading a new one…" });
        nextTimer.current = setTimeout(fetchQuestion, 800);
      } else {
        setFeedback({ type: "bad", text: message || "Something went wrong." });
      }
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    clearTimeout(nextTimer.current);
    setScore(0);
    setSavedBest(null);
    setPhase("playing");
    fetchQuestion();
  };

  if (phase === "over") {
    return (
      <div className="page page--narrow">
        <div className="card game-over">
          <div className="game-over__emoji">🍌</div>
          <h1>Round over!</h1>
          <p className="muted">You solved {score} puzzle{score === 1 ? "" : "s"}.</p>
          <div className="big-score">{score}</div>
          {savedBest !== null && (
            <p className="muted">Personal best: {savedBest}</p>
          )}
          <div className="hero__actions" style={{ justifyContent: "center", marginTop: 18 }}>
            <button className="btn btn--primary" onClick={restart}>
              Play again
            </button>
            <Link to="/leaderboard" className="btn btn--ghost">
              Leaderboard
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
            Solve the equation in the image.
          </p>
        </div>
        <span className="score-pill">Score: {score}</span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="puzzle-card">
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
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="?"
                  aria-label="Your answer"
                  disabled={busy}
                />
                <button className="btn btn--dark" type="submit" disabled={busy}>
                  {busy ? "Checking…" : "Submit"}
                </button>
              </div>
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
    </div>
  );
};

export default Game;
