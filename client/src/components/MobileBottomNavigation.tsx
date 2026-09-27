import type { ReactNode } from 'react';
import { Badge } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import './MobileBottomNavigation.css';

interface MobileNavigationItem {
  key: string;
  icon?: ReactNode;
  label: ReactNode;
  disabled: boolean;
}

interface MobileBottomNavigationProps {
  menuItems: ItemType[];
  badgeCounts?: Record<string, number>;
  currentPath: string;
  primaryAction?: string;
  onNavigate: (path: string) => void;
}

function getNavigationItems(menuItems: ItemType[]): MobileNavigationItem[] {
  return menuItems.flatMap((item) => {
    if (
      !item ||
      !('key' in item) ||
      typeof item.key !== 'string' ||
      !('label' in item) ||
      'children' in item
    ) {
      return [];
    }

    return [
      {
        key: item.key,
        icon: 'icon' in item ? item.icon : undefined,
        label: item.label,
        disabled: 'disabled' in item && Boolean(item.disabled),
      },
    ];
  });
}

function getActiveKey(items: MobileNavigationItem[], currentPath: string): string | undefined {
  return items
    .filter(
      ({ key }) =>
        currentPath === key ||
        (key.split('/').filter(Boolean).length > 1 && currentPath.startsWith(`${key}/`))
    )
    .sort((first, second) => second.key.length - first.key.length)[0]?.key;
}

export default function MobileBottomNavigation({
  menuItems,
  badgeCounts = {},
  currentPath,
  primaryAction,
  onNavigate,
}: MobileBottomNavigationProps) {
  const items = getNavigationItems(menuItems);
  const activeKey = getActiveKey(items, currentPath);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="mobile-bottom-nav"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <button
            key={item.key}
            type="button"
            className={[
              'mobile-bottom-nav__item',
              isActive ? 'is-active' : '',
              item.key === primaryAction ? 'is-primary' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={isActive ? 'page' : undefined}
            aria-label={
              item.key === primaryAction
                ? `Report an incident${isActive ? ', current page' : ''}`
                : undefined
            }
            disabled={item.disabled}
            onClick={() => onNavigate(item.key)}
          >
            {item.icon && (
              <span className="mobile-bottom-nav__icon">
                {badgeCounts[item.key] !== undefined ? (
                  <Badge count={badgeCounts[item.key]} size="small">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )}
              </span>
            )}
            <span className="mobile-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
