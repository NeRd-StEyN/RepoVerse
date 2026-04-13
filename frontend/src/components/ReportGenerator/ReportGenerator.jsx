
import React, { useState, useEffect } from "react";
import ProgressTracker from "../ProgressTracker/ProgressTracker";
import "./ReportGenerator.css";

const ReportGenerator = ({
  setTopic,
  setPdfUrl,
  setReportText,
  isGenerating,
  setIsGenerating,
  progress,
  setProgress,
  language,
  setLanguage,
  pageCount,
  setPageCount,
}) => {
  const [localTopic, setLocalTopic] = useState("");
  const [error, setError] = useState("");


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!localTopic.trim()) return;
    if (pageCount < 2 || pageCount > 10) {
      setError("Page count must be between 2 and 10.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setTopic(localTopic);
    setPdfUrl(null);


    setProgress({
      topicAnalysis: false,
      dataGathering: false,
      draftingReport: false,
      finalizing: false,
    });

    try {
      console.log("Starting report generation:", { localTopic, language, pageCount });
      const res = await fetch("/generate_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: localTopic,
          language,
          pages: pageCount,
        }),
      });

      // Determine response type before reading body
      const contentType = res.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server error: ${text}`);
      }
      if (!res.ok) throw new Error(data.error || "Failed to start report generation");
      console.log("✅ Report generation started:", data);
    } catch (err) {
      console.error("❌ Error starting report:", err);
      setError(err.message || "Error starting report.");
      setIsGenerating(false);
    }
  };


  useEffect(() => {
    if (!isGenerating || !localTopic) return;


    const cacheKey = `${localTopic}||${language}||${pageCount}`;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/progress/${encodeURIComponent(cacheKey)}`);
        if (!res.ok) throw new Error("Failed to fetch progress");

        const data = await res.json();
        setProgress(data.progress);


        if (data.is_complete) {
          clearInterval(interval);
          console.log("🎯 Report complete, fetching PDF...");

          const pdfRes = await fetch(`/report/${encodeURIComponent(cacheKey)}`);
          if (!pdfRes.ok) throw new Error("Failed to fetch report PDF");

          const pdfData = await pdfRes.json();
          if (pdfData.pdf_base64) {
            const pdfUrl = `data:application/pdf;base64,${pdfData.pdf_base64}`;
            setPdfUrl(pdfUrl);
            if (pdfData.report_text) {
              setReportText(pdfData.report_text);
            }
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
  }, [isGenerating, localTopic, language, pageCount, setProgress, setPdfUrl, setIsGenerating]);

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
        Enter a topic, choose your preferred language, and set report length.
      </p>

      <form onSubmit={handleSubmit} className="generator-form">
        { }
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
        </div>

        { }
        <div className="input-group">
          <label className="input-label">Select Language:</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isGenerating}
            className="language-select"
          >
            <option>English</option>
            <optgroup label="Indian Languages">
              <option>Hindi</option>
              <option>Tamil</option>
              <option>Telugu</option>
              <option>Bengali</option>
              <option>Marathi</option>
            </optgroup>
            <optgroup label="Foreign Languages">
              <option>Spanish</option>
              <option>French</option>
              <option>German</option>
              <option>Italian</option>
            </optgroup>
          </select>
        </div>

        { }
        <div className="input-group">
          <label className="input-label">
            Number of SubTopics (2–10):
          </label>
          <input
            type="number"
            value={pageCount}
            onChange={(e) => setPageCount(Number(e.target.value))}
            min="2"
            max="10"
            disabled={isGenerating}
            className="page-input"
          />
        </div>

        { }
        <button
          type="submit"
          className="generate-btn"
          disabled={!localTopic.trim() || isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Report"}
        </button>
      </form>

      { }
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

      { }
      <div className="tracker-container">
        <ProgressTracker progress={progress} isGenerating={isGenerating} />
      </div>

      { }
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default ReportGenerator;
