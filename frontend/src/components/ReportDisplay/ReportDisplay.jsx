import React from "react";
import "./ReportDisplay.css";

export const ReportDisplay = ({ topic, pdfUrl, isGenerating }) => {
  // Force PDF viewer settings when iframe loads
  const handleIframeLoad = (e) => {
    try {
      const iframe = e.target;
      if (iframe.contentWindow) {
        // Try to set zoom level through the PDF viewer API
        iframe.contentWindow.postMessage({
          type: 'pdf-viewer-command',
          command: 'zoom',
          value: '100'
        }, '*');
      }
    } catch (err) {
      console.log("PDF viewer settings not accessible:", err);
    }
  };
  return (
    <div className="report-display">
      <div className="report-header">
        <h3>Preview Report</h3>
      </div>

      <div className="report-content">
        {isGenerating && (
          <div className="generating-placeholder">
            <div className="loading-spinner"></div>
            <p>⏳ AI is generating your report...</p>
            <p className="loading-subtext">This may take a few moments</p>
          </div>
        )}

        {!isGenerating && pdfUrl && (
            <>
              <iframe
                src={pdfUrl.startsWith('data:') ? 
                  `${pdfUrl}#zoom=100&view=FitH` : 
                  `data:application/pdf;base64,${pdfUrl}#zoom=100&view=FitH`}
                width="100%"
                height="100%"
                title={`${topic} Report`}
                style={{ 
                  border: "none",
                  display: "block",
                  width: "100%",
                  height: "calc(100vh - 100px)", // Adjust based on your header height
                  margin: 0,
                  padding: 0,
                  backgroundColor: "white"
                }}
                onLoad={handleIframeLoad}
                onError={(e) => {
                  console.error("PDF iframe error", e);
                  // Try to detect if Chrome blocked the content
                  const isChromeBlocked = e.target.contentDocument === null;
                  if (isChromeBlocked) {
                    console.log("Chrome blocked PDF display - showing download link");
                  }
                }}
              />
              {/* Always show download link for accessibility */}
              
            </>
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
      </div>
    </div>
  );
};