import { FileText, Image, Link2, type LucideProps } from 'lucide-react';

const MAP = {
  link: Link2,
  content: FileText,
  image: Image,
} as const;

export type CrawlerTypeId = keyof typeof MAP;

export function CrawlerTypeIcon({
  type,
  size = 20,
  className,
  strokeWidth = 2,
  ...rest
}: { type: string } & Omit<LucideProps, 'ref'>) {
  const Icon = MAP[type as CrawlerTypeId] ?? Link2;
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden {...rest} />;
}
