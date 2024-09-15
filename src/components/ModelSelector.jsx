import React, { useState, useCallback } from 'react';
import { ChevronDown } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { useModel } from '../contexts/ModelContext';

const ModelSelector = React.memo(() => {
  const { isDark } = useTheme();
  const { currentModel, setCurrentModel, models } = useModel();
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleModelSelect = useCallback(
    (model) => {
      setCurrentModel(model);
      setIsOpen(false);
    },
    [setCurrentModel]
  );

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className={`flex items-center justify-between w-40 px-4 py-2 ${isDark ? "bg-[#212121] text-white" : "bg-white text-black"
          } border ${isDark ? "border-gray-700" : "border-gray-300"
          } rounded-md`}
      >
        {currentModel}
        <ChevronDown
          size={20}
          className={`transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>
      <div
        className={`absolute mt-1 w-40 ${isDark ? "bg-[#212121] text-white" : "bg-white text-black"
          } border ${isDark ? "border-gray-700" : "border-gray-300"
          } rounded-md shadow-lg transition-opacity duration-200 ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
      >
        {models.map((model) => (
          <button
            key={model}
            onClick={() => handleModelSelect(model)}
            className={`block w-full text-left px-4 py-2 ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
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