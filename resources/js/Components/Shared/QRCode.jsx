import React, { useMemo } from 'react';

// Lightweight QR renderer using a public QR image endpoint.
// Accepts `data` string and optional `size` (px). No extra deps required.
export default function QRCode({ data = '', size = 120, className = '' }) {
  const url = useMemo(() => {
    const s = Math.max(60, Math.min(512, Number(size) || 120));
    const payload = encodeURIComponent(String(data ?? ''));
    return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${payload}`;
  }, [data, size]);

  return (
    <img
      src={url}
      alt="QR code"
      width={size}
      height={size}
      className={className}
      loading="lazy"
    />
  );
}

