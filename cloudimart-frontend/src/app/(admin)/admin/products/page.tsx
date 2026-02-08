'use client';

import React, { useEffect, useState } from 'react';
import client from '../../../../lib/api/client';
import LoadingSpinner from '../../../../components/common/LoadingSpinner';
import CenteredModal from '../../../../components/common/CenteredModal';
import AdminTabs from '../../../../components/common/AdminTabs'; // reuse if present

type Category = { id: number; name: string };
type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category_id: number;
  category?: Category;
  stock: number;
  image_url?: string | null;
  image_url_full?: string | null;
  created_at?: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // note: category_id is stored as string in form to match <select> value
  const [form, setForm] = useState<any>({
    id: null,
    name: '',
    description: '',
    price: 0,
    category_id: '',
    stock: 0,
    image_url: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [messageModal, setMessageModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode }>({ show: false });
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; title?: string; body?: React.ReactNode; onConfirm?: () => void }>({ show: false });
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setFetchMessage(null);
    try {
      const [resP, resC] = await Promise.all([
        client.get('/api/admin/products'),
        client.get('/api/categories')
      ]);

      // Products: handle paginator or direct array
      const payload = resP.data;
      setProducts(payload.data ?? payload);

      // Categories: accept several shapes:
      // - { data: [...] } (paginated)
      // - { categories: [...] }
      // - [...] (raw array)
      // - { data: { data: [...] } } unlikely but be defensive
      let catPayload: any = [];
      if (resC?.data?.data) catPayload = resC.data.data;
      else if (resC?.data?.categories) catPayload = resC.data.categories;
      else if (Array.isArray(resC?.data)) catPayload = resC.data;
      else catPayload = resC?.data ?? [];

      setCategories(Array.isArray(catPayload) ? catPayload : []);
    } catch (err: any) {
      console.error('Load products error', err);
      setFetchMessage(err?.response?.data?.message ?? err?.userMessage ?? 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // open edit/create form. category_id saved as string to match <select> option values
  const openEdit = (p?: Product) => {
    if (p) {
      setForm({
        id: p.id,
        name: p.name,
        description: p.description ?? '',
        price: Number(p.price),
        category_id: String(p.category_id ?? p.category?.id ?? (categories[0]?.id ?? '')),
        stock: Number(p.stock),
        image_url: p.image_url ?? '',
      });
      setImageFile(null);
    } else {
      setForm({
        id: null,
        name: '',
        description: '',
        price: 0,
        category_id: String(categories[0]?.id ?? ''),
        stock: 0,
        image_url: '',
      });
      setImageFile(null);
    }
    setShowForm(true);
  };

  const handleFileChange = (f: File | null) => {
    setImageFile(f);
  };

  const submitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessageModal({ show: false });
    try {
      // Always send FormData (backend handles both form-data and json)
      const fd = new FormData();
      if (form.id) fd.append('id', String(form.id));
      fd.append('name', String(form.name ?? ''));
      fd.append('description', String(form.description ?? ''));
      fd.append('price', String(Number(form.price ?? 0)));
      // category_id stored as string - backend validation accepts numeric strings
      fd.append('category_id', String(form.category_id ?? ''));
      fd.append('stock', String(Number(form.stock ?? 0)));
      // If administrator typed an image_url manually (fallback), include it
      if (form.image_url) fd.append('image_url', String(form.image_url));
      if (imageFile) fd.append('image', imageFile);

      await client.post('/api/admin/products', fd, {
        headers: { 'Content-Type': 'multipart/form-data' } // axios will set boundary
      });

      setMessageModal({ show: true, title: 'Saved', body: 'Product saved successfully.' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      console.error('Save product error', err);
      setMessageModal({ show: true, title: 'Save failed', body: err?.response?.data?.message ?? err?.message ?? 'Save failed' });
    }
  };

  const confirmDelete = (p: Product) => {
    setConfirmModal({
      show: true,
      title: `Delete ${p.name}?`,
      body: `This will permanently delete product "${p.name}". This action cannot be undone.`,
      onConfirm: () => doDelete(p.id),
    });
  };

  const doDelete = async (id: number) => {
    setConfirmModal({ show: false });
    try {
      await client.delete(`/api/admin/products/${id}`);
      setMessageModal({ show: true, title: 'Deleted', body: 'Product deleted successfully.' });
      await load();
    } catch (err: any) {
      console.error('Delete product error', err);
      setMessageModal({ show: true, title: 'Delete failed', body: err?.response?.data?.message ?? err?.message ?? 'Delete failed' });
    }
  };

  if (loading) return <div className="container py-5 text-center"><LoadingSpinner /></div>;

  return (
    <div className="container py-4">
      {/* AdminTabs reuse if exists */}
      <AdminTabs />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Manage Products</h4>
        <div>
          <button className="btn btn-primary" onClick={() => openEdit()}>Add product</button>
        </div>
      </div>

      {fetchMessage && <div className="alert alert-warning">{fetchMessage}</div>}

      <div className="card mb-3">
        <div className="card-body p-2">
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td style={{ width: 120 }}>
                      {p.image_url_full ? (
                        <img src={p.image_url_full} alt={p.name} style={{ width: 84, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                      ) : p.image_url ? (
                        <img src={`/storage/${p.image_url}`} alt={p.name} style={{ width: 84, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div className="text-muted small">No image</div>
                      )}
                    </td>
                    <td>{p.name}</td>
                    <td>{p.category?.name ?? '—'}</td>
                    <td>MK {Number(p.price).toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary me-2" onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => confirmDelete(p)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Form modal (create / edit) */}
      {showForm && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <form onSubmit={submitSave}>
                <div className="modal-header">
                  <h5 className="modal-title">{form.id ? 'Edit product' : 'New product'}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowForm(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-8">
                      <input className="form-control mb-2" placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
                      <textarea className="form-control mb-2" placeholder="Description" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
                    </div>
                    <div className="col-md-4">
                      <div className="mb-2">
                        <label className="form-label small">Category</label>
                        <select
                          className="form-select"
                          value={form.category_id ?? ''}
                          onChange={(e) => setForm({...form, category_id: e.target.value})}
                          required
                        >
                          <option value="">Choose category</option>
                          {categories.map(c => (
                            <option key={c.id} value={String(c.id)}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-2">
                        <label className="form-label small">Price (MK)</label>
                        <input type="number" step="0.01" className="form-control" value={form.price} onChange={(e) => setForm({...form, price: Number(e.target.value)})} required />
                      </div>

                      <div className="mb-2">
                        <label className="form-label small">Stock</label>
                        <input type="number" className="form-control" value={form.stock} onChange={(e) => setForm({...form, stock: Number(e.target.value)})} required />
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label small">Image (optional)</label>
                      <input type="file" accept="image/*" className="form-control" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
                      <div className="form-text small">Upload product image (max 5MB). If left empty existing image will be kept.</div>

                      {imageFile && (
                        <div className="mt-2">
                          <div className="small mb-1">Preview of selected image</div>
                          <img src={URL.createObjectURL(imageFile)} alt="preview" style={{ maxWidth: 200, borderRadius: 8 }} />
                        </div>
                      )}

                      {!imageFile && form.image_url && (
                        <div className="mt-2">
                          <div className="small mb-1">Current image</div>
                          {form.image_url ? (
                            <img src={form.image_url.startsWith('http') ? form.image_url : `/storage/${form.image_url}`} alt="current" style={{ maxWidth: 200, borderRadius: 8 }} />
                          ) : null}
                        </div>
                      )}
                    </div>
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

      {/* Confirmation modal (uses CenteredModal) */}
      <CenteredModal
        show={confirmModal.show}
        title={confirmModal.title}
        body={confirmModal.body}
        onClose={() => { confirmModal.onConfirm && confirmModal.onConfirm(); setConfirmModal({ show: false }); }}
        onCancel={() => setConfirmModal({ show: false })}
        okLabel="Yes, delete"
        cancelLabel="Cancel"
        size="sm"
      />

      {/* Message modal (success / error / info) */}
      <CenteredModal
        show={messageModal.show}
        title={messageModal.title}
        body={messageModal.body}
        onClose={() => setMessageModal({ show: false })}
        okLabel="OK"
      />
    </div>
  );
}

