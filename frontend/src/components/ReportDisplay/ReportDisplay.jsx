import React, { useEffect, useState } from "react";
import "./ReportDisplay.css";

export const ReportDisplay = ({ topic, pdfUrl, isGenerating }) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device once on mount
  useEffect(() => {
    const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
  }, []);

  // Convert base64 → Blob URL for better browser compatibility
  useEffect(() => {
    if (pdfUrl && !pdfUrl.startsWith("data:application/pdf")) {
      preventAutoScroll();
      try {
        // Handle raw base64 string
        const base64Data = pdfUrl.replace(/^data:application\/pdf;base64,/, "");
        const byteCharacters = atob(base64Data);
        const byteNumbers = Array.from(byteCharacters, (c) => c.charCodeAt(0));
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);

      } catch (err) {
        console.error("Error converting PDF base64:", err);
        setPdfBlobUrl("");
      }
    } else {
      // already in data: format
      setPdfBlobUrl(pdfUrl);
    }
  }, [pdfUrl]);

  // Handle iframe load safely
  const handleIframeLoad = (e) => {
    try {
      const iframe = e.target;
      iframe.blur(); // prevent auto-scroll focus
      preventAutoScroll();
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: "pdf-viewer-command",
            command: "zoom",
            value: "100",
          },
          "*"
        );
      }
    } catch (err) {
      console.log("PDF viewer settings not accessible:", err);
    }
  };

  // Handle PDF open for mobile (new tab)
  const openPdfInNewTab = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, "_blank");
    }
  };

  // Handle download button click
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
  // Scroll back to top smoothly whenever the report changes
  window.scrollTo({ top: 0, behavior: "instant" });
};



  return (
    <div className="report-display">
      <div className="report-header">
        <h3>Preview Report</h3>
      </div>

      <div className="report-content">
        {/* Loading State */}
        {isGenerating && (
          <div className="generating-placeholder">
            <div className="loading-spinner"></div>
            <p>⏳ AI is generating your report...</p>
            <p className="loading-subtext">This may take a few moments</p>
          </div>
        )}

        {/* PDF Preview or Mobile View */}
        {!isGenerating && pdfBlobUrl && (
          <>
            {!isMobile ? (
              // Desktop inline preview
              <iframe
                tabIndex="-1"
                src={`${pdfBlobUrl}#zoom=100&view=FitH`}
                title={`${topic || "AI"} Report`}
                style={{
                  border: "none",
                  display: "block",
                  width: "100%",
                  height: "calc(100vh - 140px)", // Adjust height to fit nicely
                  backgroundColor: "white",
                }}
                onLoad={handleIframeLoad}
              />
            ) : (
              // Mobile: open in new tab
              <div className="mobile-pdf-view">
                <p>📱 PDF preview not supported on mobile.</p>
                <button
                  onClick={openPdfInNewTab}
                  className="open-mobile-btn"
                >
                  Open PDF in New Tab
                </button>
              </div>
            )}

            {/* Download Button */}
            <div className="pdf-actions">
              <button className="download-btn" onClick={handleDownload}>
                ⬇️ Download PDF
              </button>
            </div>
          </>
        )}

        {/* Empty state */}
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
