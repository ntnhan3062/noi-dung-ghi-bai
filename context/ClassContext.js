
import React, { createContext, useContext, useState, useEffect } from 'react';
import { html } from '../utils/html.js';
import { apiService } from '../services/apiService.js';

const ClassContext = createContext();

export const ClassProvider = ({ children }) => {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const config = await apiService.getFullConfig();
      const classList = (config && Array.isArray(config.classes)) ? config.classes : [];
      setClasses(classList);
      
      // Set default class
      if (classList.length > 0) {
        const defaultClass = classList.find(c => c.isDefault) || classList[0];
        setSelectedClassId(defaultClass.id);
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const updateClasses = async (newClasses) => {
    setClasses(newClasses);
    try {
      const config = await apiService.getFullConfig();
      config.classes = newClasses;
      await apiService.saveFullConfig(config);
    } catch (error) {
      console.error("Failed to save classes:", error);
    }
  };

  return html`
    <${ClassContext.Provider} value=${{ classes, selectedClassId, setSelectedClassId, updateClasses, fetchClasses, loading }}>
      ${children}
    </${ClassContext.Provider}>
  `;
};

export const useClasses = () => {
  const context = useContext(ClassContext);
  if (!context) {
    throw new Error('useClasses must be used within a ClassProvider');
  }
  return context;
};
