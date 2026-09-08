export function ChannelIcon({
  channel,
  className = 'h-4 w-4',
}: {
  channel: 'WHATSAPP' | 'INSTAGRAM';
  className?: string;
}) {
  if (channel === 'INSTAGRAM') {
    const gradientId = 'nathai-instagram-gradient';
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Instagram">
        <title>Instagram</title>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FED576" />
            <stop offset="26%" stopColor="#F47133" />
            <stop offset="61%" stopColor="#BC3081" />
            <stop offset="100%" stopColor="#4C63D2" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${gradientId})`} />
        <rect x="6.5" y="6.5" width="11" height="11" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="16.4" cy="7.6" r="1.1" fill="#fff" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="WhatsApp">
      <title>WhatsApp</title>
      <circle cx="12" cy="12" r="10" fill="#25D366" />
      <path
        d="M16.7 13.6c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.1.2-.3.2-.5.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.4-1.8-.1-.2 0-.4.1-.5.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.3 0-.4-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.3-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.4 3.8 3.4.5.2.9.4 1.3.5.5.2 1 .1 1.4.1.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1z"
        fill="#fff"
      />
    </svg>
  );
}
