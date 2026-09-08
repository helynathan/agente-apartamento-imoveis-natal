export function formatWaitingTime(since: Date, now: Date): string {
  const diffMs = now.getTime() - since.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}
