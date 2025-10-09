import type { IMiroClient, MiroItem } from './miroClient';
import { logError } from './errorHandler';

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export async function findNearbyItems(
  client: IMiroClient,
  boardId: string,
  position: { x: number; y: number },
  itemType: string,
  radius: number = 300
): Promise<MiroItem[]> {
  try {
    const items = await client.searchItems(boardId, undefined, itemType);
    return items.filter((item) => item.position && distance(item.position, position) <= radius);
  } catch (error) {
    logError(error as Error, 'proximity.findNearbyItems');
    return [];
  }
}

