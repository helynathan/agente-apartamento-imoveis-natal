import { createSector, listSectors } from '@/lib/sectors/sectorRepository';
import { db } from '@/lib/db';

const REQUIRED_SECTORS = ['Comercial', 'Administrativo', 'Financeiro'];

async function main() {
  const existing = await listSectors();
  const existingNames = new Set(existing.map((s) => s.name));

  for (const name of REQUIRED_SECTORS) {
    if (existingNames.has(name)) {
      console.log(`Setor já existe, pulando: ${name}`);
      continue;
    }
    const sector = await createSector(name);
    console.log(`Setor criado: ${sector.name} (${sector.id})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
