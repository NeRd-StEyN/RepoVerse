import React, { useEffect, useState } from "react";
import "./ReportDisplay.css";

export const ReportDisplay = ({ topic, pdfUrl, isGenerating }) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  
  useEffect(() => {
    const checkMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
  }, []);

  
  useEffect(() => {
    if (pdfUrl && !pdfUrl.startsWith("data:application/pdf")) {
      preventAutoScroll();
      try {
        
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
      
      setPdfBlobUrl(pdfUrl);
    }
  }, [pdfUrl]);

  
  const handleIframeLoad = (e) => {
    try {
      const iframe = e.target;
      iframe.blur(); 
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
            {!isMobile ? (
              
              <iframe
                tabIndex="-1"
                src={`${pdfBlobUrl}#zoom=100&view=FitH`}
                title={`${topic || "AI"} Report`}
                style={{
                  border: "none",
                  display: "block",
                  width: "100%",
                  height: "calc(100vh - 140px)", 
                  backgroundColor: "white",
                }}
                onLoad={handleIframeLoad}
              />
            ) : (
              
              <div className="mobile-pdf-notice">
                <p>📱 PDF preview not supported on mobile.</p>
                <button
                  onClick={openPdfInNewTab}
                  className="open-mobile-btn"
                >
                  Open PDF in New Tab
                </button>
              </div>
            )}

            { }
            <div className="pdf-actions">
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
