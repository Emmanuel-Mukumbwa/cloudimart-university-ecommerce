'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category_id: number;
  category?: { id: number; name: string };
  stock: number;
  image_url?: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ id: null, name: '', description: '', price: 0, category_id: '', stock: 0, image_url: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<{id:number,name:string}[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [resP, resC] = await Promise.all([
        client.get('/api/admin/products'),
        client.get('/api/categories')
      ]);
      // admin products uses paginator
      const payload = resP.data;
      setProducts(payload.data ?? payload);
      setCategories(resC.data.categories ?? resC.data ?? []);
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (p?: Product) => {
    if (p) setForm({ ...p, category_id: p.category_id ?? p.category?.id });
    else setForm({ id: null, name: '', description: '', price: 0, category_id: (categories[0]?.id ?? ''), stock: 0, image_url: '' });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      await client.post('/api/admin/products', form);
      setShowForm(false);
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Save failed');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete product?')) return;
    setMessage(null);
    try {
      await client.delete(`/api/admin/products/${id}`);
      setMessage('Deleted');
      load();
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Delete failed');
    }
  };

  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Manage Products</h4>
        <div>
          <button className="btn btn-primary" onClick={() => openEdit()}>Add product</button>
        </div>
      </div>

      {message && <div className="alert alert-info">{message}</div>}

      <div className="card mb-3">
        <div className="card-body p-2">
          <table className="table mb-0">
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category?.name ?? '—'}</td>
                  <td>MK {Number(p.price).toFixed(2)}</td>
                  <td>{p.stock}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary me-2" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={save}>
                <div className="modal-header">
                  <h5 className="modal-title">{form.id ? 'Edit product' : 'New product'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowForm(false)} />
                </div>
                <div className="modal-body">
                  <div className="mb-2">
                    <input className="form-control" placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
                  </div>
                  <div className="mb-2">
                    <select className="form-select" value={form.category_id ?? ''} onChange={(e) => setForm({...form, category_id: e.target.value})} required>
                      <option value="">Choose category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="mb-2">
                    <input type="number" step="0.01" className="form-control" placeholder="Price" value={form.price} onChange={(e) => setForm({...form, price: Number(e.target.value)})} required />
                  </div>
                  <div className="mb-2">
                    <input type="number" className="form-control" placeholder="Stock" value={form.stock} onChange={(e) => setForm({...form, stock: Number(e.target.value)})} required />
                  </div>
                  <div className="mb-2">
                    <input className="form-control" placeholder="Image URL (optional)" value={form.image_url} onChange={(e) => setForm({...form, image_url: e.target.value})} />
                  </div>
                  <div className="mb-2">
                    <textarea className="form-control" placeholder="Description" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
