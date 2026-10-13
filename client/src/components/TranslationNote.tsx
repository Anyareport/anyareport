import { Button, Typography } from 'antd';
import { useLang } from '../contexts/LanguageContext';
import type { useTranslatedTexts } from '../lib/translation';

const { Text } = Typography;

type Translation = ReturnType<typeof useTranslatedTexts>;

// Status line shown under free text when Filipino is selected. Text is
// translated automatically; the translation is labelled and the reporter's
// original stays one tap away.
export default function TranslationNote({ translation }: { translation: Translation }) {
  const { t } = useLang();
  if (!translation.canTranslate) return null;

  const stop = (action: () => void) => (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };
  const linkStyle = { padding: 0, height: 'auto', fontSize: 12 };

  // Nothing to show once a translation is displayed, other than the toggle.
  if (translation.loading) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }} aria-live="polite">
        {t('translating')}
      </Text>
    );
  }

  if (translation.failed) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }} aria-live="polite">
        {t('translationFailed')}
        <Button type="link" size="small" onClick={stop(translation.retry)} style={{ ...linkStyle, paddingLeft: 6 }}>
          {t('retry')}
        </Button>
      </Text>
    );
  }

  if (!translation.hasTranslation) return null;

  return (
    <Button type="link" size="small" onClick={stop(translation.toggleOriginal)} style={linkStyle}>
      {translation.showOriginal ? t('showTranslation') : t('showOriginal')}
    </Button>
  );
}