import { db } from '@/lib/db';

export async function createSector(name: string): Promise<{ id: string; name: string }> {
  return db.sector.create({ data: { name }, select: { id: true, name: true } });
}

export async function listSectors(): Promise<Array<{ id: string; name: string }>> {
  return db.sector.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
}
