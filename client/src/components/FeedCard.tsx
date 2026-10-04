import type { ReactNode } from 'react';
import { Card } from 'antd';
import { Link } from 'react-router-dom';

interface FeedCardProps {
  children: ReactNode;
  afterLink?: ReactNode;
  to?: string | null;
  onClick?: () => void;
  accentColor?: string;
  actions?: ReactNode[];
  className?: string;
}

export default function FeedCard({
  children,
  afterLink,
  to,
  onClick,
  accentColor,
  actions,
  className,
}: FeedCardProps) {
  return (
    <Card
      className={['feed-card', className].filter(Boolean).join(' ')}
      hoverable={Boolean(to || onClick)}
      onClick={to ? undefined : onClick}
      size="small"
      actions={actions}
      style={accentColor ? { borderInlineStart: `4px solid ${accentColor}` } : undefined}
    >
      {to ? (
        <Link to={to} className="feed-card__link" onClick={onClick}>
          {children}
        </Link>
      ) : (
        children
      )}
      {afterLink}
    </Card>
  );
}
