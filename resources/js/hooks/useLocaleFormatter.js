import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function useLocaleFormatter() {
  const { i18n } = useTranslation();

  const locale = useMemo(() => {
    const lang = (i18n.language || 'en').toLowerCase();
    return lang.startsWith('ar') ? 'ar-EG' : 'en-US';
  }, [i18n.language]);

  const formatNumber = useCallback(
    (value, options = {}) => {
      if (value === null || value === undefined || value === '') {
        return '';
      }

      const number = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(number)) {
        return value;
      }

      return new Intl.NumberFormat(locale, options).format(number);
    },
    [locale]
  );

  return { locale, formatNumber };
}
