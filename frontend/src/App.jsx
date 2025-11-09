import React, { useState } from 'react';
import Header from './components/Header/Header';
import ReportGenerator from './components/ReportGenerator/ReportGenerator';
import { ReportDisplay } from './components/ReportDisplay/ReportDisplay';
import ChatInterface from './components/ChatInterface/ChatInterface';
import './App.css';

function App() {
  const [activeTopic, setActiveTopic] = useState("");
  const [pdfData, setPdfData] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({
    topicAnalysis: false,
    dataGathering: false,
    draftingReport: false,
    finalizing: false
  });

  return (
    <div className="app">
      <Header />
      <div className="app-container">
        <div className="left-panel">
          <ReportGenerator 
            setTopic={setActiveTopic}
            setPdfUrl={setPdfData}
            isGenerating={isGenerating}
            setIsGenerating={setIsGenerating}
            progress={progress}
            setProgress={setProgress}
          />
        </div>
        <div className="right-panel">
          <ReportDisplay 
            topic={activeTopic}
            pdfUrl={pdfData}
            isGenerating={isGenerating}
          />
          <ChatInterface 
  key={activeTopic + (isGenerating ? "-gen" : "")} 
  topic={activeTopic}
  pdfUrl={pdfData}
/>

        </div>
      </div>
    </div>
  );
}

export default App;