import type { FlowerKind } from './flowers';
export type Gift = 'none' | 'flowers' | 'book' | 'tea' | 'coffee';
export type Visibility = 'public' | 'private';
export interface FestivalConfig {
  event: { name: string; date: string; timeZone: string; mode: 'rehearsal'; publicOnly?: boolean; acceptingSubmissions: boolean; autoApprove?: boolean; effectsEnabled: boolean; closingAt: string | null };
  recipients: { id: string; name: string }[];
}
export interface PublicGreeting {
  id: string; message: string; signature: string; className: string; gift: Gift;
  recipientName: string; createdAt: string; isSample?: boolean; bouquet?: FlowerKind[];bookTitle?:string;bookAuthor?:string;
}
export interface GreetingsOptions {
  showAdmin?: boolean;
  canViewFlower?():boolean;
  onViewFlower?(slot?:number):void;
  onOpenChange(open: boolean): void;
  onConfirmed(): void;
  onPublicCards(cards: PublicGreeting[]): void;
  onConfig(config: FestivalConfig): void;
}
