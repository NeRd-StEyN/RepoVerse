import React, { useEffect, useState } from "react";
import PdfViewer from "./PdfViewer";
import "./ReportDisplay.css";

export const ReportDisplay = ({
  topic,
  pdfUrl,
  setPdfUrl,
  reportText,
  setReportText,
  language,
  pageCount,
  isGenerating
}) => {
  const [activeTab, setActiveTab] = useState("preview"); // "preview" or "edit"
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [editableState, setEditableState] = useState(null);
  
  // State for AI Rewrite
  const [selectedText, setSelectedText] = useState("");
  const [selectionTarget, setSelectionTarget] = useState(null);
  const [rewriteInstruction, setRewriteInstruction] = useState("Improve Clarity");
  const [customInstruction, setCustomInstruction] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [isUpdatingPdf, setIsUpdatingPdf] = useState(false);
  const [bubbleCoords, setBubbleCoords] = useState({ x: 0, y: 0 });
  const [showRewriteMenu, setShowRewriteMenu] = useState(false);

  const normalizeBase64 = (value) => {
    return value
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
  };

  // Convert base64 to blob URL whenever pdfUrl changes
  useEffect(() => {
    if (pdfUrl) {
      if (pdfUrl.startsWith("blob:") || pdfUrl.startsWith("http")) {
        setPdfBlobUrl(pdfUrl);
        return;
      }

      try {
        const base64Data = normalizeBase64(
          pdfUrl.replace(/^data:application\/pdf;base64,/, "")
        );
        const byteCharacters = atob(base64Data);
        const byteNumbers = Array.from(byteCharacters, (c) => c.charCodeAt(0));
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
      } catch (err) {
        console.error("Error converting PDF base64:", err);
        setPdfBlobUrl(pdfUrl);
      }
    } else {
      setPdfBlobUrl("");
    }
  }, [pdfUrl]);

  // Fetch structured report state when pdfUrl becomes available
  useEffect(() => {
    if (pdfUrl && topic) {
      fetchReportState();
    } else {
      setEditableState(null);
    }
  }, [pdfUrl, topic]);

  const fetchReportState = async () => {
    try {
      const cacheKey = `${topic}||${language}||${pageCount}`;
      const res = await fetch(`/report_state?cache_key=${encodeURIComponent(cacheKey)}`);
      if (res.ok) {
        const data = await res.json();
        setEditableState(data);
      }
    } catch (err) {
      console.error("Error fetching report state:", err);
    }
  };

  const openPdfInNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, "_blank");
    }
  };

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `${topic || "report"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tracking selection dynamically on MouseUp and KeyUp
  const handleMouseUp = (e) => {
    setTimeout(() => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")
      ) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        if (start !== undefined && end !== undefined && start !== end) {
          const selected = activeEl.value.substring(start, end);
          if (selected.trim()) {
            setSelectedText(selected);
            
            const field = activeEl.getAttribute("data-field") || "heading";
            const key = activeEl.getAttribute("data-key") || null;
            
            setSelectionTarget({
              field,
              key,
              start,
              end,
              targetElement: activeEl
            });

            // Position bubble exactly above cursor click
            setBubbleCoords({
              x: e.clientX,
              y: e.clientY - 15
            });
            return;
          }
        }
      }
      
      // Only clear if we didn't expand the menu
      if (!showRewriteMenu) {
        setSelectedText("");
        setSelectionTarget(null);
      }
    }, 50);
  };

  const handleFieldChange = (val, field, key = null) => {
    setEditableState((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (key) {
        next[field] = {
          ...next[field],
          [key]: val
        };
      } else {
        next[field] = val;
      }
      return next;
    });
  };

  // Trigger regeneration of PDF
  const triggerPdfRegeneration = async (latestState = editableState) => {
    if (!latestState) return;
    setIsUpdatingPdf(true);
    try {
      const cacheKey = `${topic}||${language}||${pageCount}`;
      const res = await fetch("/update_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cache_key: cacheKey,
          state: latestState
        })
      });

      if (!res.ok) throw new Error("Failed to regenerate PDF");
      const data = await res.json();
      setPdfUrl(`data:application/pdf;base64,${data.pdf_base64}`);
    } catch (err) {
      console.error("Error updating PDF:", err);
      alert("Error regenerating PDF.");
    } finally {
      setIsUpdatingPdf(false);
    }
  };

  // Call backend AI rewrite
  const handleAiRewrite = async (instruction = "Improve clarity, engagement, and professionalism") => {
    if (!selectedText.trim() || !selectionTarget || !editableState) return;
    setIsRewriting(true);
    
    try {
      const response = await fetch("/rewrite_text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectedText,
          instruction: instruction,
        }),
      });

      if (!response.ok) throw new Error("Rewrite failed");
      const data = await response.json();
      const newText = data.rewritten_text;

      // Update editable state
      let updatedState = { ...editableState };
      const { field, key, start, end } = selectionTarget;

      if (field === "heading") {
        updatedState.heading = updatedState.heading.substring(0, start) + newText + updatedState.heading.substring(end);
      } else if (field === "intro") {
        updatedState.intro = updatedState.intro.substring(0, start) + newText + updatedState.intro.substring(end);
      } else if (field === "conclusion") {
        updatedState.conclusion = updatedState.conclusion.substring(0, start) + newText + updatedState.conclusion.substring(end);
      } else if (field === "summaries" && key) {
        updatedState.summaries = {
          ...updatedState.summaries,
          [key]: updatedState.summaries[key].substring(0, start) + newText + updatedState.summaries[key].substring(end)
        };
      } else if (field === "insights" && key) {
        updatedState.insights = {
          ...updatedState.insights,
          [key]: updatedState.insights[key].substring(0, start) + newText + updatedState.insights[key].substring(end)
        };
      }

      setEditableState(updatedState);
      setSelectedText("");
      setSelectionTarget(null);
      setShowRewriteMenu(false);
      
      // Auto trigger PDF rebuild so it updates instantly!
      await triggerPdfRegeneration(updatedState);
    } catch (err) {
      console.error(err);
      alert("AI Rewrite failed. Please try again.");
    } finally {
      setIsRewriting(false);
      setShowRewriteMenu(false);
    }
  };

  const presetInstructions = ["Improve Clarity", "Make More Formal", "Make Engaging", "Shorten Text", "Expand Explanation", "Custom"];

  return (
    <div className="report-display">
      <div className="report-header">
        <h3>Preview & Edit Report</h3>
        {pdfBlobUrl && !isGenerating && (
          <div className="tab-buttons">
            <button 
              className={`tab-btn ${activeTab === "preview" ? "active" : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              📄 PDF Preview
            </button>
            <button 
              className={`tab-btn ${activeTab === "edit" ? "active" : ""}`}
              onClick={() => setActiveTab("edit")}
            >
              ✍️ Edit Report
            </button>
          </div>
        )}
      </div>

      <div className="report-content">
        {isGenerating && (
          <div className="generating-placeholder">
            <div className="loading-spinner"></div>
            <p>⏳ AI is generating your report...</p>
            <p className="loading-subtext">This may take a few moments</p>
          </div>
        )}

        {!isGenerating && !pdfUrl && (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>No report generated yet</p>
            <p className="empty-subtext">
              Start by generating a report from the left panel
            </p>
          </div>
        )}

        {!isGenerating && pdfBlobUrl && (
          <>
            {activeTab === "preview" && (
              <div className="pdf-preview-container" style={{ flex: 1, minHeight: 0 }}>
                <PdfViewer pdfData={pdfUrl} topic={topic} />
              </div>
            )}

            {activeTab === "edit" && editableState && (
              <div className="report-editor-container">
                <div className="editor-fields" onMouseUp={handleMouseUp} onKeyUp={handleMouseUp}>
                  <div className="editor-field-group">
                    <label>Report Heading</label>
                    <input 
                      type="text" 
                      data-field="heading"
                      value={editableState.heading || ""} 
                      onChange={(e) => handleFieldChange(e.target.value, "heading")}
                    />
                  </div>

                  <div className="editor-field-group">
                    <label>Introduction</label>
                    <textarea 
                      data-field="intro"
                      value={editableState.intro || ""} 
                      onChange={(e) => handleFieldChange(e.target.value, "intro")}
                    />
                  </div>

                  {Object.keys(editableState.summaries || {}).map((subtopic) => (
                    <div key={subtopic} className="editor-subtopic-section">
                      <h4>Subtopic: {subtopic}</h4>
                      
                      <div className="editor-field-group">
                        <label>Content Summary</label>
                        <textarea 
                          data-field="summaries"
                          data-key={subtopic}
                          value={editableState.summaries[subtopic] || ""} 
                          onChange={(e) => handleFieldChange(e.target.value, "summaries", subtopic)}
                        />
                      </div>

                      <div className="editor-field-group">
                        <label>Key Insights (Bullet points)</label>
                        <textarea 
                          data-field="insights"
                          data-key={subtopic}
                          value={editableState.insights[subtopic] || ""} 
                          onChange={(e) => handleFieldChange(e.target.value, "insights", subtopic)}
                          placeholder="List key insights separated by lines..."
                        />
                      </div>
                    </div>
                  ))}

                  <div className="editor-field-group">
                    <label>Conclusion</label>
                    <textarea 
                      data-field="conclusion"
                      value={editableState.conclusion || ""} 
                      onChange={(e) => handleFieldChange(e.target.value, "conclusion")}
                    />
                  </div>
                </div>

                {/* Floating AI Rewrite tool bubble anchored at select coordinates */}
                {selectedText && (
                  <div 
                    className="ai-floating-bubble"
                    style={{ 
                      position: "fixed", 
                      left: `${bubbleCoords.x}px`, 
                      top: `${bubbleCoords.y}px`,
                      zIndex: 1000,
                      transform: "translate(-50%, -100%)"
                    }}
                  >
                    <button 
                      className="bubble-trigger-btn"
                      disabled={isRewriting}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAiRewrite("Improve clarity, engagement, and professionalism");
                      }}
                    >
                      {isRewriting ? "🪄 Rewriting..." : "✨ Rewrite with AI"}
                    </button>
                  </div>
                )}

                <div className="editor-actions">
                  <button 
                    className="regenerate-pdf-btn" 
                    onClick={() => triggerPdfRegeneration()}
                    disabled={isUpdatingPdf}
                  >
                    {isUpdatingPdf ? "💾 Regenerating PDF..." : "💾 Update PDF Preview"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
