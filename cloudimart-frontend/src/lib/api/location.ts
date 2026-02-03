//src/lib/api/location.ts
import client from './client';

export async function fetchLocations() {
  const res = await client.get('/api/locations');
  return res.data;
}
 