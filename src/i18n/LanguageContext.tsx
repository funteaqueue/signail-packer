import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Language, translations } from './translations';

const STORAGE_KEY = 'packer:language';

const detectInitialLanguage = (): Language => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'uk') {
            return stored;
        }
    } catch {
        // localStorage unavailable (private mode etc.) — fall through to browser language
    }
    const browserLanguage = typeof navigator !== 'undefined' && navigator.language
        ? navigator.language.toLowerCase()
        : '';
    if (browserLanguage.startsWith('uk') || browserLanguage.startsWith('ru')) {
        return 'uk';
    }
    return 'en';
};

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface LanguageContextValue {
    language: Language;
    setLanguage: (language: Language) => void;
    t: TranslateFn;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

    const setLanguage = useCallback((nextLanguage: Language) => {
        setLanguageState(nextLanguage);
        try {
            localStorage.setItem(STORAGE_KEY, nextLanguage);
        } catch {
            // localStorage unavailable — the choice just won't persist
        }
    }, []);

    const t = useCallback<TranslateFn>((key, params) => {
        const template = translations[language][key] ?? translations.en[key] ?? key;
        if (!params) {
            return template;
        }
        return template.replace(/\{(\w+)\}/g, (match, name) =>
            params[name] !== undefined ? String(params[name]) : match
        );
    }, [language]);

    const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useTranslation = (): LanguageContextValue => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};
