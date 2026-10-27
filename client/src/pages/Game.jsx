import { useState, useEffect } from "react";
import api from "../api";

const Game = () => {
  const [question, setQuestion] = useState(null);
  const [solution, setSolution] = useState(null);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const fetchQuestion = async () => {
    setLoading(true);
    setFeedback("");
    setAnswer("");
    try {
      const res = await api.get("/game/question");
      setQuestion(res.data.question);
      setSolution(res.data.solution);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const userAnswer = parseInt(answer);
    if (isNaN(userAnswer)) {
      setFeedback("Please enter a number");
      return;
    }

    if (userAnswer === solution) {
      setScore(score + 1);
      setFeedback("Correct! 🎉");
      setTimeout(() => {
        fetchQuestion();
      }, 1000);
    } else {
      setFeedback(`Wrong! The answer was ${solution}`);
      // Save score when game ends
      try {
        await api.post("/game/score", { score });
      } catch (err) {
        console.error(err);
      }
      setGameOver(true);
    }
  };

  const playAgain = () => {
    setScore(0);
    setGameOver(false);
    fetchQuestion();
  };

  if (gameOver) {
    return (
      <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "2rem", textAlign: "center" }}>
        <h1>Game Over!</h1>
        <h2>Your Score: {score}</h2>
        <button onClick={playAgain} style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}>Play Again</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "2rem", textAlign: "center" }}>
      <h1>BrainRoyale Game</h1>
      <h2>Score: {score}</h2>
      {loading && <p>Loading question...</p>}
      {question && !loading && (
        <div>
          <img src={question} alt="Puzzle" style={{ maxWidth: "100%", margin: "1rem 0", border: "1px solid #ccc" }} />
          <form onSubmit={handleSubmit}>
            <input
              type="number"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Enter your answer"
              style={{ padding: "0.5rem", marginRight: "0.5rem" }}
            />
            <button type="submit" style={{ padding: "0.5rem 1rem" }}>Submit</button>
          </form>
          {feedback && <p style={{ marginTop: "1rem", fontWeight: "bold" }}>{feedback}</p>}
        </div>
      )}
    </div>
  );
};

export default Game;
