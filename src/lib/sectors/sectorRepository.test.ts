import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { createSector, listSectors } from '@/lib/sectors/sectorRepository';

describe('sectorRepository', () => {
  afterEach(async () => {
    await db.sector.deleteMany();
  });

  it('creates a sector', async () => {
    const sector = await createSector('Financeiro');
    expect(sector.name).toBe('Financeiro');
  });

  it('lists sectors ordered by name', async () => {
    await createSector('Suporte');
    await createSector('Financeiro');

    const sectors = await listSectors();

    expect(sectors.map((s) => s.name)).toEqual(['Financeiro', 'Suporte']);
  });
});
