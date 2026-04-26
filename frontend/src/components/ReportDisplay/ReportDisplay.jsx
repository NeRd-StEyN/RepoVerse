import React, { useEffect, useState } from "react";
import "./ReportDisplay.css";

export const ReportDisplay = ({ topic, pdfUrl, isGenerating }) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");


  const normalizeBase64 = (value) => {
    return value
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
  };


  useEffect(() => {
    if (pdfUrl) {
      preventAutoScroll();

      if (pdfUrl.startsWith("blob:") || pdfUrl.startsWith("http")) {
        setPdfBlobUrl(pdfUrl);
        return;
      }

      try {
        // Strip data prefix if present and convert base64 to blob
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
  const preventAutoScroll = () => {

    window.scrollTo({ top: 0, behavior: "instant" });
  };



  return (
    <div className="report-display">
      <div className="report-header">
        <h3>Preview Report</h3>
      </div>

      <div className="report-content">
        { }
        {isGenerating && (
          <div className="generating-placeholder">
            <div className="loading-spinner"></div>
            <p>⏳ AI is generating your report...</p>
            <p className="loading-subtext">This may take a few moments</p>
          </div>
        )}

        { }
        {!isGenerating && pdfBlobUrl && (
          <>
            <div className="pdf-actions">
              <button className="download-btn" onClick={openPdfInNewTab}>
                Open in New Tab
              </button>
              <button className="download-btn" onClick={handleDownload}>
                ⬇️ Download PDF
              </button>
            </div>
          </>
        )}

        { }
        {!isGenerating && !pdfUrl && (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>No report generated yet</p>
            <p className="empty-subtext">
              Start by generating a report from the left panel
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
