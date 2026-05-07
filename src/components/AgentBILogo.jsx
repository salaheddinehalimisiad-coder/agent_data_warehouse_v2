// src/components/AgentBILogo.jsx — Logo robot Agent BI
import React from 'react';

export default function AgentBILogo({
  size = 40,
  variant = 'mark',
  animated = true,
  className = '',
  title = 'Agent BI',
}) {
  const src = '/image-removebg-preview(21).png';
  return (
    <img
      src={src}
      alt={title}
      width={size}
      height={size}
      className={className}
      style={{
        display: 'block',
        objectFit: 'contain',
        filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.3))',
        transition: 'transform 0.3s ease',
      }}
    />
  );
}
