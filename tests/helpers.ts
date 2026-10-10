import { getDb, openDb, setDb } from '../src/server/db';

/** Fresh, migrated + seeded in-memory database for each test. */
export function freshDb() {
  const db = openDb(':memory:');
  setDb(db);
  return db;
}

export function catId(siteSlug: string, catSlug: string): string {
  return (
    getDb()
      .prepare('SELECT c.id FROM categories c JOIN sites s ON s.id = c.site_id WHERE s.slug = ? AND c.slug = ?')
      .get(siteSlug, catSlug) as { id: string }
  ).id;
}
