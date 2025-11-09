// components/ReportGenerator/ReportGenerator.jsx
import React, { useState, useEffect } from "react";
import ProgressTracker from "../ProgressTracker/ProgressTracker";
import "./ReportGenerator.css";

const ReportGenerator = ({
  setTopic,
  setPdfUrl,
  isGenerating,
  setIsGenerating,
  progress,
  setProgress,
}) => {
  const [localTopic, setLocalTopic] = useState("");
  const [error, setError] = useState("");

  // 🧠 Handle topic submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!localTopic.trim()) return;

    setIsGenerating(true);
    setError("");
    setTopic(localTopic);
    setPdfUrl(null);

    // Reset progress
    setProgress({
      topicAnalysis: false,
      dataGathering: false,
      draftingReport: false,
      finalizing: false,
    });

    try {
      console.log("Starting report generation. Sending topic to backend:", localTopic);
      const res = await fetch("/generate_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: localTopic }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start report generation");
      console.log("✅ Report generation started:", data);
    } catch (err) {
      console.error("❌ Error starting report:", err);
      setError(err.message || "Error starting report.");
      setIsGenerating(false);
    }
  };

  // 🔁 Poll for progress + fetch PDF once complete
  useEffect(() => {
    if (!isGenerating || !localTopic) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/progress/${encodeURIComponent(localTopic)}`
        );
        if (!res.ok) throw new Error("Failed to fetch progress");

        const data = await res.json();
        setProgress(data.progress);

        // ✅ When generation completes, fetch PDF
        if (data.is_complete) {
          clearInterval(interval);
          console.log("🎯 Report complete, fetching PDF...");

          const pdfRes = await fetch(
            `/report/${encodeURIComponent(localTopic)}`
          );
          if (!pdfRes.ok) throw new Error("Failed to fetch report PDF");

          const pdfData = await pdfRes.json();
          if (pdfData.pdf_base64) {
            const pdfUrl = `data:application/pdf;base64,${pdfData.pdf_base64}`;
            setPdfUrl(pdfUrl);
            console.log("✅ PDF ready for preview");
          } else {
            throw new Error("PDF data missing in response");
          }

          setIsGenerating(false);
        }
      } catch (err) {
        console.error("⚠️ Progress polling error:", err);
        setError("Error fetching progress or report data.");
        setIsGenerating(false);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating, localTopic, setProgress, setPdfUrl, setIsGenerating]);

  const exampleTopics = [
    "Artificial Intelligence in Healthcare",
    "Impact of Renewable Energy",
    "Climate Change Effects",
    "Blockchain in Finance",
  ];

  return (
    <div className="report-generator">
      <h2>Generate New Report</h2>
      <p className="description">
        Enter a topic and let our AI create a detailed report for you.
      </p>

      <form onSubmit={handleSubmit} className="generator-form">
        <div className="input-group">
          <input
            type="text"
            value={localTopic}
            onChange={(e) => setLocalTopic(e.target.value)}
            placeholder="e.g., 'AI in Healthcare'"
            className="topic-input"
            disabled={isGenerating}
            maxLength={60}
          />
          <button
            type="submit"
            className="generate-btn"
            disabled={!localTopic.trim() || isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </form>

      <div className="examples">
        <p className="examples-title">Example topics:</p>
        <div className="example-tags">
          {exampleTopics.map((example, i) => (
            <span
              key={i}
              className="example-tag"
              onClick={() => setLocalTopic(example)}
            >
              {example}
            </span>
          ))}
        </div>
      </div>

      <div className="tracker-container">
        <ProgressTracker progress={progress} isGenerating={isGenerating} />
      </div>

      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default ReportGenerator;
