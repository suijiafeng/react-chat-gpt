import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { getModels } from '../apis/models';
import { useAuth } from '../hooks'
const ModelSelector = React.memo(() => {
  const [models, setModels] = useState([]);
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const { isLoggedIn } = useAuth()
  const [currentModel, setCurrentModel] = useState(() => {
    return localStorage.getItem('currentModel') || '';
  });
  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleModelSelect = useCallback(
    (model) => {
      setCurrentModel(model);
      localStorage.setItem('currentModel', model);
      setIsOpen(false);
    },
    [setCurrentModel]
  );

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await getModels();
        if (res.statusText === "OK") {
          const modelIds = res.data.data.map(item => item.id);
          setModels(modelIds);
          if (modelIds.length > 0) {
            setCurrentModel(prevModel => prevModel || modelIds[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      }
    };
    isLoggedIn && fetchModels()
  }, [isLoggedIn])
  return (
    <div className="relative ">
      <button
        onClick={toggleOpen}
        className={`flex items-center justify-between min-w-40 px-4 py-2 ${isDark ? "bg-[#212121] text-white" : "bg-white text-black"
          } border ${isDark ? "border-gray-700" : "border-gray-300"
          } rounded-md transition-colors duration-300`}
      >
        {currentModel}
        <ChevronDown
          size={20}
          className={`transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>
      <div
        className={`absolute mt-1 min-w-40 transition-colors duration-300 ${isDark ? "bg-[#212121] text-white" : "bg-white text-black"
          } border ${isDark ? "border-gray-700" : "border-gray-300"
          } rounded-md shadow-lg ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
      >
        {models.map((model) => (
          <button
            key={model}
            onClick={() => handleModelSelect(model)}
            className={`block w-full text-left px-4 py-2  ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
              } ${currentModel === model ? "font-bold" : ""}`}
          >
            {model}
          </button>
        ))}
      </div>
    </div>
  );
});

export default ModelSelector;