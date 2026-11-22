/**
 * A stand-in for `astro:content`, which only exists inside an Astro build.
 *
 * A test registers it with `vi.mock("astro:content", () => import(...))`, fills
 * {@link collections} with the entries it needs, and calls {@link resetContent}
 * between tests. Entries are plain objects shaped like the real ones; a test
 * only spells out the fields the code under test reads.
 */

interface Entry {
  data: Record<string, unknown>
  id: string
}

export const collections: Record<string, Entry[]> = {}

/**
 * Empties every collection, so no test sees another's entries.
 */
export function resetContent(): void {
  for (const name of Object.keys(collections)) delete collections[name]
}

/**
 * Lists a collection's entries, filtered the way the real one is.
 *
 * @param name - The collection.
 * @param filter - Keeps the entries it returns true for.
 *
 * @returns The matching entries.
 */
export async function getCollection(
  name: string,
  filter: (entry: Entry) => unknown = () => true
): Promise<Entry[]> {
  return (collections[name] ?? []).filter(filter)
}

/**
 * Finds one entry by its id.
 *
 * @param name - The collection.
 * @param id - The entry's id.
 *
 * @returns The entry, or `undefined` when the collection has none by that id.
 */
export async function getEntry(
  name: string,
  id: string
): Promise<Entry | undefined> {
  return collections[name]?.find((entry) => entry.id === id)
}
