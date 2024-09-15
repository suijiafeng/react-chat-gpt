import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';

const ModelContext = createContext();

export const useModel = () => useContext(ModelContext);

export const ModelProvider = ({ children }) => {
  const models = useMemo(() => ["llama3.1:latest", "GPT-3.5", "GPT-4", "Claude-2", "DALL-E"], []);

  // 从 localStorage 中加载初始值
  const [currentModel, setCurrentModel] = useState(() => {
    const savedModel = localStorage.getItem('currentModel');
    return savedModel || models[0];
  });

  // 当 currentModel 变化时，保存到 localStorage
  useEffect(() => {
    localStorage.setItem('currentModel', currentModel);
  }, [currentModel]);

  const value = useMemo(
    () => ({ currentModel, setCurrentModel, models }),
    [currentModel, models]
  );
  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
};
