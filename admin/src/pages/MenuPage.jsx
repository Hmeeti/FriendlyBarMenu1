import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const emptyItem = {
  name: '',
  description: '',
  weight: '',
  price: 0,
  imageUrl: 'image/nono.png',
  availability: 'IN_STOCK',
  isActive: true,
  categoryId: '',
};

export default function MenuPage() {
  const { user } = useAuth();
  const canDelete = user?.role === 'SUPER_ADMIN';
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [variantName, setVariantName] = useState('');
  const [variantDelta, setVariantDelta] = useState(0);
  const [error, setError] = useState('');
  const [newCat, setNewCat] = useState('');

  async function reload() {
    const [c, i] = await Promise.all([
      api.categories(),
      api.items({ ...(categoryId ? { categoryId } : {}), ...(q ? { q } : {}) }),
    ]);
    setCategories(c.categories);
    setItems(i.items);
    if (!form.categoryId && c.categories[0]) {
      setForm((f) => ({ ...f, categoryId: c.categories[0].id }));
    }
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [categoryId, q]);

  const catMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.title])),
    [categories]
  );

  function startCreate() {
    setEditing('new');
    setForm({ ...emptyItem, categoryId: categoryId || categories[0]?.id || '' });
  }

  function startEdit(item) {
    setEditing(item.id);
    setForm({
      name: item.name,
      description: item.description || '',
      weight: item.weight || '',
      price: item.price,
      imageUrl: item.imageUrl,
      availability: item.availability,
      isActive: item.isActive,
      categoryId: item.categoryId,
      variants: item.variants || [],
    });
  }

  async function saveItem(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
      };
      delete payload.variants;
      if (editing === 'new') await api.createItem(payload);
      else await api.updateItem(editing, payload);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(id) {
    if (!canDelete || !confirm('Delete this dish permanently?')) return;
    await api.deleteItem(id);
    await reload();
  }

  async function onUpload(file) {
    if (!file) return;
    const { imageUrl } = await api.upload(file);
    setForm((f) => ({ ...f, imageUrl }));
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCat.trim()) return;
    await api.createCategory({ title: newCat.trim() });
    setNewCat('');
    await reload();
  }

  async function toggleCategory(cat) {
    await api.updateCategory(cat.id, { isActive: !cat.isActive });
    await reload();
  }

  async function removeCategory(id) {
    if (!canDelete || !confirm('Delete category and its items?')) return;
    await api.deleteCategory(id);
    if (categoryId === id) setCategoryId('');
    await reload();
  }

  async function addVariant() {
    if (editing === 'new' || !variantName.trim()) return;
    await api.createVariant(editing, { name: variantName.trim(), priceDelta: Number(variantDelta) || 0 });
    setVariantName('');
    setVariantDelta(0);
    const { items: fresh } = await api.items();
    const item = fresh.find((x) => x.id === editing);
    if (item) startEdit(item);
    setItems(fresh);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl mb-1">Menu</h1>
          <p className="text-[var(--muted)]">Categories, dishes, prices, stock, variants, images.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startCreate}>Add dish</button>
      </div>

      {error && <div className="mb-4 text-sm text-[var(--warn)]">{error}</div>}

      <div className="grid lg:grid-cols-[280px_1fr] gap-5">
        <section className="card p-4 h-fit">
          <h2 className="text-xl mb-3">Categories</h2>
          <form onSubmit={addCategory} className="flex gap-2 mb-4">
            <input className="input" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <button className="btn btn-ghost" type="submit">+</button>
          </form>
          <button
            type="button"
            className={`w-full text-left rounded-lg px-3 py-2 mb-1 text-sm ${!categoryId ? 'bg-[var(--accent-soft)]' : 'hover:bg-white'}`}
            onClick={() => setCategoryId('')}
          >
            All dishes
          </button>
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-1 mb-1">
              <button
                type="button"
                className={`flex-1 text-left rounded-lg px-3 py-2 text-sm ${categoryId === c.id ? 'bg-[var(--accent-soft)]' : 'hover:bg-white'}`}
                onClick={() => setCategoryId(c.id)}
              >
                {c.title}
                <span className="text-[var(--muted)]"> · {c._count?.items ?? 0}</span>
                {!c.isActive && <span className="badge badge-off ml-2">off</span>}
              </button>
              <button type="button" className="btn btn-ghost !px-2" title="Toggle" onClick={() => toggleCategory(c)}>↻</button>
              {canDelete && (
                <button type="button" className="btn btn-danger !px-2" onClick={() => removeCategory(c.id)}>×</button>
              )}
            </div>
          ))}
        </section>

        <section>
          <div className="mb-4">
            <input className="input max-w-md" placeholder="Search dishes…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {editing && (
            <form onSubmit={saveItem} className="card p-5 mb-5 grid md:grid-cols-2 gap-4">
              <h2 className="md:col-span-2 text-2xl">{editing === 'new' ? 'New dish' : 'Edit dish'}</h2>
              <div>
                <label className="text-sm">Name</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Category</label>
                <select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Price (тг)</label>
                <input className="input" type="number" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Weight</label>
                <input className="input" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">Description</label>
                <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="text-sm">Availability</label>
                <select className="select" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })}>
                  <option value="IN_STOCK">In stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  Visible on menu
                </label>
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <img src={form.imageUrl.startsWith('http') || form.imageUrl.startsWith('/') ? form.imageUrl : `/${form.imageUrl}`} alt="" className="w-16 h-16 object-cover rounded-lg border border-[var(--line)]" />
                <input className="input max-w-sm" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
                <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />
              </div>

              {editing !== 'new' && (
                <div className="md:col-span-2 border-t border-[var(--line)] pt-4">
                  <h3 className="font-semibold mb-2">Variants</h3>
                  <ul className="text-sm mb-3 space-y-1">
                    {(form.variants || []).map((v) => (
                      <li key={v.id} className="flex justify-between gap-2">
                        <span>{v.name} ({v.priceDelta >= 0 ? '+' : ''}{v.priceDelta})</span>
                        <button type="button" className="text-[var(--warn)]" onClick={async () => { await api.deleteVariant(v.id); startEdit({ ...form, id: editing, categoryId: form.categoryId, variants: (form.variants || []).filter((x) => x.id !== v.id) }); await reload(); }}>delete</button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <input className="input max-w-[180px]" placeholder="Variant name" value={variantName} onChange={(e) => setVariantName(e.target.value)} />
                    <input className="input max-w-[120px]" type="number" placeholder="Δ price" value={variantDelta} onChange={(e) => setVariantDelta(e.target.value)} />
                    <button type="button" className="btn btn-ghost" onClick={addVariant}>Add variant</button>
                  </div>
                </div>
              )}

              <div className="md:col-span-2 flex gap-2">
                <button className="btn btn-primary" type="submit">Save</button>
                <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </form>
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f3eee5] text-left">
                <tr>
                  <th className="p-3">Dish</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--line)]">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={item.imageUrl.startsWith('/') || item.imageUrl.startsWith('http') ? item.imageUrl : `/${item.imageUrl}`} alt="" className="w-10 h-10 rounded object-cover" />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-[var(--muted)] text-xs">{item.weight}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{catMap[item.categoryId] || '—'}</td>
                    <td className="p-3">{item.price} тг</td>
                    <td className="p-3">
                      <span className={`badge ${item.availability === 'IN_STOCK' ? 'badge-ok' : 'badge-off'}`}>
                        {item.availability === 'IN_STOCK' ? 'In stock' : 'Out of stock'}
                      </span>
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button type="button" className="btn btn-ghost !py-1" onClick={() => startEdit(item)}>Edit</button>
                      <button
                        type="button"
                        className="btn btn-ghost !py-1"
                        onClick={async () => {
                          await api.updateItem(item.id, {
                            availability: item.availability === 'IN_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK',
                          });
                          await reload();
                        }}
                      >
                        Toggle stock
                      </button>
                      {canDelete && (
                        <button type="button" className="btn btn-danger !py-1" onClick={() => removeItem(item.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <div className="p-6 text-[var(--muted)]">No dishes found.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
