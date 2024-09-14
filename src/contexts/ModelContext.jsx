import React, { createContext, useContext, useState, useMemo } from 'react';

const ModelContext = createContext();

export const useModel = () => useContext(ModelContext);

export const ModelProvider = ({ children }) => {
  const [currentModel, setCurrentModel] = useState("GPT-3.5");
  const models = useMemo(() => ["GPT-3.5", "GPT-4", "Claude-2", "DALL-E"], []);
  const value = useMemo(
    () => ({ currentModel, setCurrentModel, models }),
    [currentModel, models]
  );
  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
};