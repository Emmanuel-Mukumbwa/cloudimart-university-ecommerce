import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

export function useProducts({ page=1, per_page=12, q='', category='' } = {}) {
  return useQuery(['products', {page, per_page, q, category}], async () => {
    const res = await client.get('/api/products', { params: { page, per_page, q, category } });
    return res.data;
  }, { keepPreviousData: true });
}
