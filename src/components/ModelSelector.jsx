import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { getModels } from '../apis/models';
import { useAuth } from '../hooks'

const DEMO_MODELS = ['demo-assistant', 'llama3.1:latest'];

const ModelSelector = React.memo(() => {
  const [models, setModels] = useState([]);
  const { isDark, classes } = useTheme();
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
      if (localStorage.getItem('demo_mode') === 'true') {
        setModels(DEMO_MODELS);
        setCurrentModel((prevModel) => prevModel || DEMO_MODELS[0]);
        return;
      }

      try {
        const res = await getModels();
        if (res.statusText === "OK") {
          const modelIds = res.data.data.map(item => item.id);
          setModels(modelIds);
          if (modelIds.length > 0) {
            setCurrentModel((prevModel) => prevModel || modelIds[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
        if (!currentModel) {
          setModels(DEMO_MODELS);
          setCurrentModel(DEMO_MODELS[0]);
        }
      }
    };
    isLoggedIn && fetchModels()
  }, [currentModel, isLoggedIn])
  return (
    <div className="relative ">
      <button
        onClick={toggleOpen}
        className={`flex items-center justify-between min-w-40 px-4 py-2 text-sm ${
          isDark ? 'bg-[#2a2a2a] text-white border-white/10' : 'bg-white text-black border-gray-300'
        } border rounded-xl ${classes.themeTransition}`}
      >
        {currentModel}
        <ChevronDown
          size={20}
          className={`transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>
      <div
        className={`absolute right-0 mt-2 min-w-48 transition-colors duration-300 ${
          isDark ? 'bg-[#2a2a2a] text-white border-white/10' : 'bg-white text-black border-gray-300'
          } border rounded-2xl shadow-lg ${classes.themeTransition} ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
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

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
