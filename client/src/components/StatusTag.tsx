import { Tag } from 'antd';
import { getStatusLabel } from '../lib/reportWorkflow';
import { getStatusTagStyle } from '../lib/statusTagStyles';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { getLocalizedStatus } from '../i18n/labels';

export default function StatusTag({ status }: { status: string }) {
  const { role } = useAuth();
  const { lang, t } = useLang();

  const label =
    lang === 'fil' && ['tanod', 'responder'].includes(role || '')
      ? getLocalizedStatus(status, t)
      : formatStatus(status);

  return <Tag style={getStatusTagStyle(status)}>{label}</Tag>;
}

export function formatStatus(status: string) {
  return getStatusLabel(status);
}
