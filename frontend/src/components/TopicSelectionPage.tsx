import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";

const TopicSelectionPage = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // This is the new logic to fetch topics from the backend
    const fetchTopics = async () => {
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

        const response = await fetch("http://127.0.0.1:5000/extract_topics", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to extract topics from the PDF."
          );
        }

        const data = await response.json();
        setTopics(
          data.topics.map((topic, index) => ({
            id: `topic${index + 1}`,
            name: topic,
          }))
        );
      } catch (error) {
        console.error("Error fetching topics:", error);
        setErrorMessage(
          error.message || "Failed to load topics. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, [navigate]);

  const handleTopicClick = (topicId) => {
    setSelectedTopics((prevSelected) => {
      if (prevSelected.includes(topicId)) {
        return prevSelected.filter((id) => id !== topicId);
      } else {
        return [...prevSelected, topicId];
      }
    });
  };

  const handleGenerateClick = async () => {
    if (selectedTopics.length === 0) {
      setErrorMessage("Please select at least one topic.");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");

    const quizParams = JSON.parse(localStorage.getItem("quizParameters"));
    const uploadedFile = JSON.parse(localStorage.getItem("uploadedFile"));

    if (!quizParams || !uploadedFile) {
      setErrorMessage("Quiz parameters or file not found.");
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    const dummyFile = new Blob(["dummy content"], { type: "application/pdf" });
    formData.append("pdf_file", dummyFile, uploadedFile.name);
    formData.append("difficulty", quizParams.difficulty);
    formData.append("numQuestions", quizParams.numQuestions);
    formData.append("topics", JSON.stringify(selectedTopics));

    try {
      const response = await fetch("http://127.0.0.1:5000/generate_quiz", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Something went wrong on the server."
        );
      }

      const data = await response.json();
      localStorage.setItem("generatedMcqs", JSON.stringify(data.mcqs));
      localStorage.removeItem("quizParameters");
      localStorage.removeItem("uploadedFile");
      navigate("/quiz");
    } catch (error) {
      console.error("Error generating quiz:", error);
      setErrorMessage(
        error.message || "Failed to generate quiz. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl p-8 rounded-2xl glow-border backdrop-blur-md bg-white/5 shadow-xl">
        <h2 className="text-3xl font-bold tracking-wider text-center text-white mb-8">
          Select Topics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          {topics.map((topic) => (
            <div
              key={topic.id}
              onClick={() => handleTopicClick(topic.id)}
              className={`relative p-8 rounded-2xl shadow-lg cursor-pointer transition-all duration-300
                bg-gray-800 border-2 
                ${
                  selectedTopics.includes(topic.id)
                    ? "border-primary ring-4 ring-primary transform scale-105"
                    : "border-gray-700 hover:transform hover:scale-105 hover:border-primary-light"
                }`}
            >
              <p className="text-xl font-medium text-white text-center drop-shadow-lg">
                {topic.name}
              </p>
              {selectedTopics.includes(topic.id) && (
                <CheckCircle
                  className="absolute top-4 right-4 text-primary drop-shadow-lg"
                  size={28}
                />
              )}
            </div>
          ))}
        </div>
        {errorMessage && (
          <p className="text-red-500 text-sm mt-2 text-center">
            {errorMessage}
          </p>
        )}
        <div className="text-center mt-8">
          <button
            onClick={handleGenerateClick}
            disabled={selectedTopics.length === 0 || isLoading}
            className="magic-button px-8 py-4 rounded-xl text-xl font-medium text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Generating..." : "Generate Quiz →"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicSelectionPage;
