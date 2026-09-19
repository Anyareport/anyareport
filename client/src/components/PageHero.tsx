import type { ReactNode } from 'react';
import { Card, Typography, Button, Space, Badge } from 'antd';
import type { ButtonType } from 'antd/es/button';

const { Title, Paragraph } = Typography;

export interface PageHeroProps {
  title: string;
  description?: string;
  actions?: Array<{
    type?: ButtonType;
    icon?: ReactNode;
    label: string;
    onClick?: () => void;
    href?: string;
  }>;
  icon?: ReactNode;
  badgeCount?: number;
  children?: ReactNode;
  className?: string;
}

export default function PageHero({
  title,
  description,
  actions = [],
  icon,
  badgeCount,
  children,
  className = '',
}: PageHeroProps) {
  return (
    <Card className={`soft-card page-hero ${className}`}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {(icon || badgeCount !== undefined) && (
          <Space size={16} style={{ alignItems: 'flex-start' }}>
            {icon && (
              <Badge count={badgeCount} offset={[14, 0]}>
                {icon}
              </Badge>
            )}
          </Space>
        )}
        <Title level={2} style={{ margin: 0 }}>
          {title}
        </Title>
        {description && <Paragraph style={{ margin: 0 }}>{description}</Paragraph>}
        {actions.length > 0 && (
          <Space wrap>
            {actions.map((action, index) => (
              <Button
                key={index}
                type={action.type || 'primary'}
                icon={action.icon}
                onClick={action.onClick}
                href={action.href}
                target={action.href ? '_self' : undefined}
              >
                {action.label}
              </Button>
            ))}
          </Space>
        )}
        {children}
      </Space>
    </Card>
  );
}
