import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SummaryPage = () => {
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSummaryAndKeywords = async () => {
      const uploadedFile = JSON.parse(localStorage.getItem("uploadedFile"));
      if (!uploadedFile) {
        setErrorMessage("No file uploaded. Please go back to the dashboard.");
        return;
      }

      setIsLoading(true);
      try {
        const formData = new FormData();
        // This is a temporary fix for the file not being available.
        // In a real application, you would store the file or a reference to it on the backend.
        const dummyFile = new Blob(["dummy content"], {
          type: "application/pdf",
        });
        formData.append("pdf_file", dummyFile, uploadedFile.name);

        // NEW ENDPOINT
        const response = await fetch(
          "http://127.0.0.1:5000/extract_topics_and_summary",
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to get summary and keywords."
          );
        }

        const data = await response.json();
        setSummary(data.summary);
        setKeywords(data.keywords);
      } catch (error) {
        console.error("Error fetching summary:", error);
        setErrorMessage(
          error.message || "Failed to get summary. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchSummaryAndKeywords();
  }, [navigate]);

  const handleProceedWithQuiz = () => {
    // Navigate directly to the quiz page, implicitly using the summarized content
    // We will need to adjust the backend logic to handle this
    navigate("/quiz");
  };

  const handleChooseTopics = () => {
    // Navigate to the topic selection page
    navigate("/topics");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white text-xl">
        Loading summary and keywords...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl p-8 rounded-2xl glow-border backdrop-blur-md bg-white/5 shadow-xl text-white">
        <h2 className="text-3xl font-bold tracking-wider text-center mb-6">
          Summary
        </h2>
        {errorMessage && (
          <p className="text-red-500 text-sm mt-2 text-center mb-4">
            {errorMessage}
          </p>
        )}
        <p className="text-lg text-gray-300 mb-6">{summary}</p>

        <h3 className="text-2xl font-bold tracking-wider mb-4">Keywords</h3>
        <div className="flex flex-wrap gap-2 mb-8">
          {keywords.map((keyword, index) => (
            <span
              key={index}
              className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium"
            >
              {keyword}
            </span>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <button
            onClick={handleProceedWithQuiz}
            className="magic-button w-full px-6 py-3 rounded-xl text-lg font-medium text-white transition-all duration-300"
          >
            Proceed with Quiz →
          </button>
          <button
            onClick={handleChooseTopics}
            className="magic-button w-full px-6 py-3 rounded-xl text-lg font-medium text-white transition-all duration-300 bg-gray-700 hover:bg-gray-600"
          >
            Choose Topics →
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryPage;
