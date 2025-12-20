import React from 'react';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: 'pending' | 'published' | 'archived';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
