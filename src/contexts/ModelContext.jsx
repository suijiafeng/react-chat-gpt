import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { getModels } from '../apis/models';

const ModelContext = createContext();

export const useModel = () => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
};

export const ModelProvider = ({ children }) => {
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState(() => {
    return localStorage.getItem('currentModel') || '';
  });

  const fetchModels = useCallback(async () => {
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
  }, []); // 没有依赖项

  useEffect(() => {
    fetchModels();
  }, []); // 只在挂载时运行一次

  useEffect(() => {
    if (currentModel) {
      localStorage.setItem('currentModel', currentModel);
    }
  }, [currentModel]);

  const value = useMemo(() => ({
    currentModel,
    setCurrentModel,
    models,
    refreshModels: fetchModels
  }), [currentModel, models, fetchModels]);

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
};