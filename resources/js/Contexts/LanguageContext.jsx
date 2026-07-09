import React, { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children, userLanguage = null }) => {
  const { i18n } = useTranslation();

  // Get language from prop, localStorage, or default to 'en'
  const getInitialLanguage = () => {
    if (userLanguage) {
      return userLanguage;
    }
    // No authenticated user (guest pages) — always use English
    return 'en';
  };

  const initialLang = getInitialLanguage();
  const [currentLanguage, setCurrentLanguage] = useState(initialLang);
  const [direction, setDirection] = useState(
    initialLang === 'ar' ? 'rtl' : 'ltr'
  );

  // Sync with user language when it changes
  useEffect(() => {
    if (userLanguage && userLanguage !== currentLanguage) {
      const newDirection = userLanguage === 'ar' ? 'rtl' : 'ltr';
      setCurrentLanguage(userLanguage);
      setDirection(newDirection);
      i18n.changeLanguage(userLanguage);
      localStorage.setItem('language', userLanguage);
      document.documentElement.setAttribute('dir', newDirection);
      document.documentElement.setAttribute('lang', userLanguage);
    }
  }, [userLanguage]);

  useEffect(() => {
    // Set initial language
    i18n.changeLanguage(currentLanguage);
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', currentLanguage);
  }, []);

  const changeLanguage = (lang) => {
    const newDirection = lang === 'ar' ? 'rtl' : 'ltr';

    setCurrentLanguage(lang);
    setDirection(newDirection);

    // Update i18n
    i18n.changeLanguage(lang);

    // Persist to localStorage
    localStorage.setItem('language', lang);

    // Update HTML attributes
    document.documentElement.setAttribute('dir', newDirection);
    document.documentElement.setAttribute('lang', lang);
  };

  const value = {
    currentLanguage,
    direction,
    changeLanguage,
    isRTL: direction === 'rtl'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
