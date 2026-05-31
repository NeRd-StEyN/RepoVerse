import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker from the public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Sub-component to render an individual PDF page on canvas with high-DPI scaling
const PdfPage = React.forwardRef(({ 
  pdfDoc, 
  pageNum, 
  zoom, 
  rotation, 
  containerWidth, 
  fitMode 
}, ref) => {
  const canvasRef = useRef(null);
  const [viewportSize, setViewportSize] = useState(null);
  const renderTaskRef = useRef(null);

  // Fetch unscaled page viewport sizes to establish aspect ratios instantly (prevents layout shifts)
  useEffect(() => {
    let isMounted = true;
    const fetchPageDimensions = async () => {
      if (!pdfDoc) return;
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isMounted) {
          const unscaledViewport = page.getViewport({ scale: 1, rotation });
          setViewportSize({ 
            width: unscaledViewport.width, 
            height: unscaledViewport.height 
          });
        }
      } catch (err) {
        console.error(`Error reading page dimensions for page ${pageNum}:`, err);
      }
    };

    fetchPageDimensions();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc, pageNum, rotation]);

  // Handle actual high-DPI canvas rendering
  useEffect(() => {
    let isCancelled = false;
    
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current || !viewportSize) return;
      
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Determine correct render scale
        let scale = zoom;
        if (fitMode === 'width' && containerWidth > 40) {
          // Adjust width calculation to fit container minus page shadows/paddings
          const targetWidth = containerWidth;
          scale = (targetWidth / viewportSize.width) * zoom;
        } else {
          // Responsive auto-scale down if page is wider than container
          const availableWidth = containerWidth;
          if (availableWidth > 40 && (viewportSize.width * zoom) > availableWidth) {
            scale = availableWidth / viewportSize.width;
          }
        }

        const outputScale = Math.max(window.devicePixelRatio || 1, 2);
        
        // Use the base CSS scale for viewport
        const viewport = page.getViewport({ scale: scale, rotation });

        // Make actual canvas bitmap larger by outputScale
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
        };

        // Cancel running render tasks for this canvas to avoid overlap
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, zoom, rotation, containerWidth, fitMode, viewportSize]);

  // Calculate layout dimensions beforehand to occupy perfect placeholder spaces
  let displayWidth = 595; // default A4 ratio
  let displayHeight = 842;
  if (viewportSize) {
    let scale = zoom;
    if (fitMode === 'width' && containerWidth > 40) {
      const targetWidth = containerWidth;
      scale = (targetWidth / viewportSize.width) * zoom;
    } else {
      // Responsive auto-scale down if page is wider than container
      const availableWidth = containerWidth;
      if (availableWidth > 40 && (viewportSize.width * zoom) > availableWidth) {
        scale = availableWidth / viewportSize.width;
      }
    }
    displayWidth = viewportSize.width * scale;
    displayHeight = viewportSize.height * scale;
  }

  return (
    <div 
      ref={ref}
      className="chrome-pdf-page-container" 
      data-page-number={pageNum}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

// Primary Custom Chrome-Style PDF Viewer Component
const PdfViewer = ({ pdfData, topic }) => {
  const scrollContainerRef = useRef(null);
  const containerWrapperRef = useRef(null);
  const pageRefs = useRef({});
  const resizeObserverRef = useRef(null);

  // Core Viewer States
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageInput, setCurrentPageInput] = useState('1');
  const [zoom, setZoom] = useState(1.25);
  const [fitMode, setFitMode] = useState('none'); // 'width' or 'none'
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270 degrees
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [pdfBlobUrl, setPdfBlobUrl] = useState('');

  // Extract / convert PDF source to Blob URL for print operations
  useEffect(() => {
    if (!pdfData) return;
    
    if (pdfData.startsWith('blob:') || pdfData.startsWith('http')) {
      setPdfBlobUrl(pdfData);
      return;
    }

    try {
      const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
      const binaryData = atob(base64Data);
      const uint8Array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }
      const blob = new Blob([uint8Array], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      console.error("Error creating Blob URL inside PdfViewer:", err);
    }
  }, [pdfData]);

  // Load PDF document on mount or source data changes
  const loadPdf = async () => {
    if (!pdfData) return;
    setLoading(true);
    setError(null);
    try {
      let loadingTask;
      if (pdfData.startsWith('data:application/pdf;base64,')) {
        const base64Data = pdfData.replace(/^data:application\/pdf;base64,/, '');
        const binaryData = atob(base64Data);
        const uint8Array = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          uint8Array[i] = binaryData.charCodeAt(i);
        }
        loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      } else {
        loadingTask = pdfjsLib.getDocument(pdfData);
      }

      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      setCurrentPageInput('1');
    } catch (err) {
      console.error('Error loading PDF document:', err);
      setError('Failed to load the PDF preview. You can still download the report directly.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPdf();
  }, [pdfData]);

  // Observe container width changes to keep rendering responsive and crisp
  useEffect(() => {
    if (scrollContainerRef.current) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        if (entries && entries[0]) {
          setContainerWidth(entries[0].contentRect.width);
        }
      });
      resizeObserverRef.current.observe(scrollContainerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  // Sync scroll indicator text with page changes
  useEffect(() => {
    setCurrentPageInput(currentPage.toString());
  }, [currentPage]);

  // Setup page scroll intersection observing to detect active viewport page
  useEffect(() => {
    if (!pdfDoc || numPages === 0 || !scrollContainerRef.current) return;

    const observerOptions = {
      root: scrollContainerRef.current,
      rootMargin: '-20% 0px -60% 0px', // Center-focused intersection frame
      threshold: 0.1
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number'), 10);
          if (pageNum) {
            setCurrentPage(pageNum);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    // Allow a tiny window for elements to mount fully
    const timer = setTimeout(() => {
      Object.keys(pageRefs.current).forEach(key => {
        const el = pageRefs.current[key];
        if (el) observer.observe(el);
      });
    }, 400);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [pdfDoc, numPages, zoom, fitMode, rotation]);

  // Scroll smoothly to a target page
  const scrollToPage = (pageNum) => {
    if (pageNum < 1 || pageNum > numPages) return;
    const targetElement = pageRefs.current[pageNum];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }
  };

  // Zoom controls
  const handleZoomOut = () => {
    setFitMode('none');
    setZoom(prev => Math.max(0.5, prev - 0.15));
  };

  const handleZoomIn = () => {
    setFitMode('none');
    setZoom(prev => Math.min(3.0, prev + 0.15));
  };

  const handleZoomSelect = (e) => {
    const value = e.target.value;
    if (value === 'width') {
      setFitMode('width');
      setZoom(1.0);
    } else {
      setFitMode('none');
      setZoom(parseFloat(value));
    }
  };

  // Rotation
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Download PDF
  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `${topic || "report"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF using an iframe context or direct window opening
  const handlePrint = () => {
    if (!pdfBlobUrl) return;
    // Escaping Hugging Face iframe print restrictions by opening a print window
    const printWindow = window.open(pdfBlobUrl);
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    } else {
      // Fallback: load hidden print iframe
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = pdfBlobUrl;
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.error("Iframe print blocked, downloading instead:", e);
          handleDownload();
        }
      };
      document.body.appendChild(iframe);
    }
  };

  // Keypress or input navigations
  const handlePageInputSubmit = (e) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(currentPageInput, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= numPages) {
        scrollToPage(pageNum);
      } else {
        setCurrentPageInput(currentPage.toString());
      }
    }
  };

  const handlePageInputChange = (e) => {
    setCurrentPageInput(e.target.value);
  };

  const handlePageInputBlur = () => {
    setCurrentPageInput(currentPage.toString());
  };

  const pageList = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div ref={containerWrapperRef} className="chrome-pdf-viewer">
      
      {/* Chrome Style Top Toolbar */}
      <div className="chrome-pdf-toolbar">
        
        {/* Left Side Section: Doc name & quick page steps */}
        <div className="toolbar-left">
          <div className="doc-title-container">
            {/* Elegant Vector PDF document icon */}
            <svg className="doc-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#ff4d4d"/>
              <path d="M14 2V8H20L14 2Z" fill="#b30000" opacity="0.8"/>
              <path d="M9 13C8.45 13 8 13.45 8 14V17C8 17.55 8.45 18 9 18C9.55 18 10 17.55 10 17V14C10 13.45 9.55 13 9 13Z" fill="white"/>
              <path d="M12 13H14C14.55 13 15 13.45 15 14V15C15 15.55 14.55 16 14 16H12.5V18H12V13ZM12.5 14V15H13.5V14H12.5Z" fill="white"/>
              <path d="M16 13H18V14H16.5V15H17.5V16H16.5V18H16V13Z" fill="white"/>
            </svg>
            <span className="doc-name" title={`${topic || 'Report'}.pdf`}>
              {topic ? `${topic.replace(/[^a-zA-Z0-9_\- ]/g, '')}.pdf` : 'Report.pdf'}
            </span>
          </div>

          <div className="page-indicator">
            <button 
              className="toolbar-btn" 
              data-tooltip="Previous page" 
              onClick={() => scrollToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            
            <input 
              type="text" 
              className="page-input"
              value={currentPageInput}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputSubmit}
              onBlur={handlePageInputBlur}
            />
            <span className="page-total">/ {numPages || 1}</span>

            <button 
              className="toolbar-btn" 
              data-tooltip="Next page" 
              onClick={() => scrollToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        {/* Center Section: Responsive Zoom Actions */}
        <div className="toolbar-center">
          <div className="zoom-container">
            <button className="toolbar-btn" data-tooltip="Zoom Out" onClick={handleZoomOut} disabled={zoom <= 0.5}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>

            <select 
              className="zoom-select" 
              value={fitMode === 'width' ? 'width' : zoom.toString()} 
              onChange={handleZoomSelect}
            >
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
              <option value="2">200%</option>
              <option value="width">Fit to Width</option>
            </select>

            <button className="toolbar-btn" data-tooltip="Zoom In" onClick={handleZoomIn} disabled={zoom >= 3.0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Right Section: Rotate, Print, Download */}
        <div className="toolbar-right">
          <button className="toolbar-btn" data-tooltip="Rotate Clockwise" onClick={handleRotate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>

          <button className="toolbar-btn" data-tooltip="Print Report" onClick={handlePrint}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"></polyline>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
              <rect x="6" y="14" width="12" height="8"></rect>
            </svg>
          </button>

          <button className="toolbar-btn" data-tooltip="Download Report" onClick={handleDownload}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>

      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="chrome-pdf-loading">
          <div className="loading-spinner"></div>
          <p>Processing report pages...</p>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="chrome-pdf-error">
          <p>{error}</p>
          <button className="retry-btn" onClick={loadPdf}>Retry Loading</button>
        </div>
      )}

      {/* Scrollable multi-page canvas area */}
      {!loading && !error && (
        <div ref={scrollContainerRef} className="chrome-pdf-pages-container">
          {pageList.map((pageNum) => (
            <PdfPage
              key={`${pageNum}-${zoom}-${rotation}`}
              ref={(el) => (pageRefs.current[pageNum] = el)}
              pdfDoc={pdfDoc}
              pageNum={pageNum}
              zoom={zoom}
              rotation={rotation}
              containerWidth={containerWidth}
              fitMode={fitMode}
            />
          ))}
        </div>
      )}

    </div>
  );
};

export default PdfViewer;
