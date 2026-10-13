import {
  FireOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Grid, Popover, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import './EmergencyHotline.css';

const { Text } = Typography;

interface EmergencyHotlineProps {
  reportId?: string;
  category?: string;
  subcategory?: string | null;
  referenceNumber?: string | null;
}

interface HotlineContact {
  id: 'bfp' | 'pnp' | 'red-cross' | '911';
  name: string;
  description: string;
  number: string;
  icon: React.ReactNode;
}

function getDialNumber(value: string, isNationalHotline = false) {
  const trimmed = value.trim();
  if (!trimmed || /[a-z]/i.test(trimmed)) return null;

  const dialNumber = trimmed.replace(/[\s().-]/g, '');
  if (isNationalHotline && dialNumber === '911') return dialNumber;
  if (!/^\+?\d+$/.test(dialNumber)) return null;

  const digits = dialNumber.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || /^(\d)\1+$/.test(digits)) return null;
  return dialNumber;
}

function getContacts(translate: boolean): HotlineContact[] {
  return [
    {
      id: 'bfp',
      name: 'Bureau of Fire Protection',
      description: translate ? 'BFP · sunog at rescue' : 'BFP · fire and rescue',
      number: import.meta.env.VITE_HOTLINE_BFP_NUMBER || '',
      icon: <FireOutlined />,
    },
    {
      id: 'pnp',
      name: 'Philippine National Police',
      description: translate ? 'PNP · krimen at kaligtasan' : 'PNP · crime and public safety',
      number: import.meta.env.VITE_HOTLINE_PNP_NUMBER || '',
      icon: <SafetyOutlined />,
    },
    {
      id: 'red-cross',
      name: 'Philippine Red Cross',
      description: translate ? 'Tulong medikal at ambulansya' : 'Medical and ambulance assistance',
      number: import.meta.env.VITE_HOTLINE_RED_CROSS_NUMBER || '',
      icon: <MedicineBoxOutlined />,
    },
    {
      id: '911',
      name: 'National Emergency Hotline',
      description: translate
        ? 'Pulis, bumbero, medikal, at rescue'
        : 'Police, fire, medical, and rescue',
      number: '911',
      icon: <PhoneOutlined />,
    },
  ];
}

export default function EmergencyHotline({
  reportId,
  category,
  subcategory,
  referenceNumber,
}: EmergencyHotlineProps) {
  const screens = Grid.useBreakpoint();
  const { role } = useAuth();
  const { lang, t } = useLang();
  const translate = lang === 'fil' && ['tanod', 'responder'].includes(role || '');
  const text = (key: Parameters<typeof t>[0], english: string) => (translate ? t(key) : english);
  const [open, setOpen] = useState(false);
  const isMobile = !screens.md;
  const isCriminalCase = category === 'Blotter Cases' && subcategory === 'Criminal';
  const isEmergency = category === 'Emergency Situations';

  if (!reportId || (!isEmergency && !isCriminalCase)) return null;

  const title = text('callHelp', 'Call for help');
  const incidentLabel = isCriminalCase
    ? `${text('blotterCase', 'Blotter')} · ${text('criminal', 'Criminal')}`
    : text('emergency', 'Emergency');
  const subtitle = `${referenceNumber || text('incidentLabel', 'Incident')} · ${incidentLabel}`;
  const contacts = getContacts(translate);

  const panel = (
    <div className={`emergency-hotline__panel${isMobile ? ' is-mobile' : ''}`}>
      <Space direction="vertical" size={8} className="emergency-hotline__list">
        {contacts.map((contact) => {
          const dialNumber = getDialNumber(contact.number, contact.id === '911');
          const isSuggested = isCriminalCase && contact.id === 'pnp';

          return (
            <div
              className={`emergency-hotline__row${isSuggested ? ' is-suggested' : ''}`}
              key={contact.id}
            >
              <span className="emergency-hotline__icon" aria-hidden="true">
                {contact.icon}
              </span>
              <div className="emergency-hotline__details">
                <div className="emergency-hotline__name-line">
                  <Text strong>{contact.name}</Text>
                  {isSuggested && <Tag color="blue">{text('criminalCase', 'Criminal case')}</Tag>}
                </div>
                <Text type="secondary" className="emergency-hotline__description">
                  {dialNumber
                    ? `${contact.description} · ${contact.number}`
                    : text('numberNotConfigured', 'Number not configured')}
                </Text>
              </div>
              <Button
                type="primary"
                icon={<PhoneOutlined />}
                href={dialNumber ? `tel:${dialNumber}` : undefined}
                disabled={!dialNumber}
                aria-label={`${text('call', 'Call')} ${contact.name}${dialNumber ? ` at ${contact.number}` : ''}`}
                onClick={() => {
                  if (!dialNumber) return;
                  void api
                    .post(`/api/reports/${reportId}/hotline-opened`, { agency: contact.id })
                    .catch((error: Error) =>
                      console.warn('Hotline selection was not logged:', error)
                    );
                }}
              >
                {text('call', 'Call')}
              </Button>
            </div>
          );
        })}
      </Space>
      <Text type="secondary" className="emergency-hotline__note">
        {text(
          'hotlineNote',
          'Tapping Call records “Hotline opened” on this incident. Anyareport cannot confirm whether the call connected or was answered.'
        )}
      </Text>
    </div>
  );

  const trigger = (
    <Button
      color="primary"
      variant="outlined"
      size="large"
      icon={<PhoneOutlined />}
      onClick={() => setOpen(true)}
    >
      {text('hotlines', 'Hotlines')}
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          className="emergency-hotline__drawer"
          placement="bottom"
          height="min(82dvh, 620px)"
          open={open}
          onClose={() => setOpen(false)}
          title={<div className="emergency-hotline__drawer-title">{title}</div>}
          footer={
            <Button block onClick={() => setOpen(false)}>
              {text('close', 'Close')}
            </Button>
          }
          zIndex={1400}
        >
          <div className="emergency-hotline__drawer-subtitle">{subtitle}</div>
          {panel}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="rightTop"
      title={
        <div className="emergency-hotline__popover-title">
          <Text strong>{text('hotlines', 'Hotlines')}</Text>
          <Text type="secondary">{subtitle}</Text>
        </div>
      }
      content={panel}
    >
      {trigger}
    </Popover>
  );
}
