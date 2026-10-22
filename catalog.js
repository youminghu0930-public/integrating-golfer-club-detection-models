let pending;
// One request shared by the banner, snapshot carousel, and comparison player.
export function readCatalog() {
  if (!pending) pending = fetch('materials/data/catalog.json').then(response => {
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    return response.json();
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
