import React from "react";
import "./ProgressTracker.css";

const ProgressTracker = ({ topic, progress = {}, isGenerating = false }) => {
  const [currentProgress, setCurrentProgress] = React.useState(progress);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!topic || !isGenerating) return;

    const pollProgress = async () => {
      try {
        const response = await fetch(`/progress/${encodeURIComponent(topic)}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        setCurrentProgress(data.progress);


        if (data.status === "completed" || data.status === "failed") {
          return;
        }
      } catch (err) {
        console.error("Error fetching progress:", err);
        setError("Failed to fetch progress updates");
      }
    };


    const interval = setInterval(pollProgress, 2000);
    return () => clearInterval(interval);
  }, [topic, isGenerating]);

  const stages = [
    { key: "topicAnalysis", label: "Topic Analysis", description: "Analyzing the topic and planning structure" },
    { key: "dataGathering", label: "Data Gathering", description: "Researching and collecting information" },
    { key: "draftingReport", label: "Drafting Report", description: "Writing summaries and insights" },
    { key: "finalizing", label: "Finalizing", description: "Creating PDF" },
  ];

  const currentStageIndex = stages.findIndex((s) => !progress[s.key]);
  const allCompleted = stages.every((s) => progress[s.key]);

  return (
    <div className="progress-tracker">
      <h3>🧠 Report Generation Progress</h3>
      <div className="progress-stages">
        {stages.map((stage, index) => {
          const isCompleted = progress[stage.key];

          const isCurrent =
            isGenerating && index === currentStageIndex && !allCompleted;
          const isUpcoming =
            (!isGenerating && !isCompleted) ||
            (index > currentStageIndex && !isCompleted);

          return (
            <div
              key={stage.key}
              className={`progress-stage 
                ${isCompleted ? "completed" : ""} 
                ${isCurrent ? "current" : ""} 
                ${isUpcoming ? "upcoming" : ""}`}
            >
              <div className="stage-indicator">
                <div
                  className={`indicator-circle ${isCompleted
                      ? "completed"
                      : isCurrent
                        ? "in-progress"
                        : "pending"
                    }`}
                >
                  {isCompleted ? "✓" : isCurrent ? "⟳" : index + 1}
                </div>
              </div>

              <div className="stage-info">
                <span className="stage-label">{stage.label}</span>
                <span className="stage-description">{stage.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressTracker;
