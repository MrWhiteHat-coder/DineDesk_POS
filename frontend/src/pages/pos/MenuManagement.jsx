import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import {
  Plus, Pencil, Trash2, FolderPlus, Image, Leaf, Clock, Upload, X, FlaskConical,
} from 'lucide-react';
import { inventoryAPI, menuAPI, uploadFile } from '../../lib/api';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_URL}${imageUrl}`;
};

export default function MenuManagement() {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  // Category Modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);

  // Item Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    is_vegetarian: false,
    is_available: true,
    preparation_time: '15',
    image_url: '',
    recipe: [],
  });
  const [itemLoading, setItemLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    fetchMenu();
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await inventoryAPI.getAll();
      setInventoryItems(res.data);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    }
  };

  const fetchMenu = async () => {
    try {
      const [catRes, itemsRes] = await Promise.all([
        menuAPI.getCategories(),
        menuAPI.getItems(),
      ]);
      setCategories(catRes.data);
      setMenuItems(itemsRes.data);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      setLoading(false);
    }
  };

  // Category handlers
  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      toast.error('Category name is required');
      return;
    }

    setCategoryLoading(true);
    try {
      await menuAPI.createCategory({
        name: categoryName,
        description: categoryDescription,
        sort_order: categories.length,
      });
      toast.success('Category created');
      setShowCategoryModal(false);
      setCategoryName('');
      setCategoryDescription('');
      fetchMenu();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create category');
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category?')) return;

    try {
      await menuAPI.deleteCategory(categoryId);
      toast.success('Category deleted');
      fetchMenu();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete category');
    }
  };

  // Item handlers
  const openItemModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        name: item.name,
        description: item.description || '',
        price: item.price.toString(),
        category_id: item.category_id,
        is_vegetarian: item.is_vegetarian,
        is_available: item.is_available,
        preparation_time: item.preparation_time.toString(),
        image_url: item.image_url || '',
        recipe: item.recipe || [],
      });
    } else {
      setEditingItem(null);
      const defaultCategoryId = selectedCategory || (categories.length > 0 ? categories[0].id : '');
      setItemForm({
        name: '',
        description: '',
        price: '',
        category_id: defaultCategoryId,
        is_vegetarian: false,
        is_available: true,
        preparation_time: '15',
        image_url: '',
        recipe: [],
      });
    }
    setShowItemModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      setItemForm((prev) => ({ ...prev, image_url: url }));
      toast.success('Image uploaded successfully');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemForm.name.trim() || !itemForm.price || !itemForm.category_id) {
      toast.error('Please fill all required fields');
      return;
    }

    setItemLoading(true);
    try {
      const data = {
        ...itemForm,
        price: parseFloat(itemForm.price),
        preparation_time: parseInt(itemForm.preparation_time),
      };

      if (editingItem) {
        await menuAPI.updateItem(editingItem.id, data);
        toast.success('Item updated');
      } else {
        await menuAPI.createItem(data);
        toast.success('Item created');
      }

      setShowItemModal(false);
      fetchMenu();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save item');
    } finally {
      setItemLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this item?')) return;

    try {
      await menuAPI.deleteItem(itemId);
      toast.success('Item deleted');
      fetchMenu();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete item');
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await menuAPI.updateItem(item.id, { is_available: !item.is_available });
      fetchMenu();
      toast.success(`${item.name} is now ${!item.is_available ? 'available' : 'unavailable'}`);
    } catch (err) {
      toast.error('Failed to update availability');
    }
  };

  const filteredItems = selectedCategory
    ? menuItems.filter((i) => i.category_id === selectedCategory)
    : menuItems;

  const getCategoryCount = (catId) => {
    return menuItems.filter(i => i.category_id === catId).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="menu-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-slate-900">Menu Management</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCategoryModal(true)}
            className="h-9 px-3 rounded-lg text-sm"
            data-testid="add-category-btn"
          >
            <FolderPlus className="w-4 h-4 mr-1.5" />
            Add Category
          </Button>
          <Button
            onClick={() => openItemModal()}
            className="h-9 px-3 rounded-lg bg-black hover:bg-gray-800 text-sm"
            data-testid="add-item-btn"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            !selectedCategory ? 'bg-black text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Items
          <span className={`text-xs px-1.5 py-0.5 rounded-md ${
            !selectedCategory ? 'bg-white/20' : 'bg-slate-100'
          }`}>
            {menuItems.length}
          </span>
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-1">
            <button
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat.id ? 'bg-black text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                selectedCategory === cat.id ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                {getCategoryCount(cat.id)}
              </span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteCategory(cat.id)}
              className="text-slate-400 hover:text-red-500 h-7 w-7 p-0 rounded-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden rounded-xl border-slate-200 hover:shadow-md transition-shadow" data-testid={`menu-item-card-${item.id}`}>
              <div className="relative aspect-[4/3] bg-slate-100">
                <img
                  src={getImageUrl(item.image_url) || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop';
                  }}
                />
                <div className="absolute top-2 right-2">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white ${item.is_available ? 'text-green-700' : 'text-red-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.is_available ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="font-semibold text-slate-900 text-sm mb-0.5 truncate">{item.name}</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-base text-slate-900">
                    ₹{item.price.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {item.preparation_time} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={item.is_available}
                      onCheckedChange={() => handleToggleAvailability(item)}
                      className="scale-75 origin-left"
                      data-testid={`toggle-availability-${item.id}`}
                    />
                    <span className="text-[11px] text-slate-500">Available</span>
                  </div>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openItemModal(item)}
                      className="h-7 w-7 p-0 rounded-md"
                      data-testid={`edit-item-${item.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                      className="h-7 w-7 p-0 rounded-md text-red-500 hover:text-red-600"
                      data-testid={`delete-item-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center rounded-2xl">
          <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No menu items yet</p>
          <Button onClick={() => openItemModal()} className="bg-black hover:bg-gray-800 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Item
          </Button>
        </Card>
      )}

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Starters, Main Course"
                className="h-11 rounded-xl"
                data-testid="category-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Optional description"
                className="rounded-xl"
                data-testid="category-description-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCategoryModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={categoryLoading}
              className="bg-black hover:bg-gray-800 rounded-xl"
              data-testid="save-category-btn"
            >
              {categoryLoading ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Item Image</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4">
                {itemForm.image_url ? (
                  <div className="relative">
                    <img
                      src={getImageUrl(itemForm.image_url)}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-xl"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=200&fit=crop';
                      }}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setItemForm((prev) => ({ ...prev, image_url: '' }))}
                      className="absolute top-2 right-2 h-8 w-8 p-0 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-3 py-6">
                      {uploadingImage ? (
                        <div className="w-8 h-8 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-10 h-10 text-slate-400" />
                      )}
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700">
                          {uploadingImage ? 'Uploading...' : 'Click to upload image'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB</p>
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Item Details */}
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Butter Chicken"
                className="h-11 rounded-xl"
                data-testid="item-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the item"
                className="rounded-xl"
                data-testid="item-description-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (₹) *</Label>
                <Input
                  type="number"
                  value={itemForm.price}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  data-testid="item-price-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                {categories.length === 0 ? (
                  <p className="text-sm text-amber-600 p-3 bg-amber-50 rounded-xl">
                    Please create a category first
                  </p>
                ) : (
                  <Select
                    value={itemForm.category_id}
                    onValueChange={(val) => setItemForm((prev) => ({ ...prev, category_id: val }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl" data-testid="item-category-select">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preparation Time (minutes)</Label>
              <Input
                type="number"
                value={itemForm.preparation_time}
                onChange={(e) =>
                  setItemForm((prev) => ({ ...prev, preparation_time: e.target.value }))
                }
                placeholder="15"
                className="h-11 rounded-xl"
                data-testid="item-prep-time-input"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white rounded flex items-center justify-center border-2 border-green-500">
                  <div className={`w-3 h-3 rounded-full ${itemForm.is_vegetarian ? 'bg-green-500' : 'bg-transparent'}`}></div>
                </div>
                <Label className="cursor-pointer">Vegetarian</Label>
              </div>
              <Switch
                checked={itemForm.is_vegetarian}
                onCheckedChange={(checked) =>
                  setItemForm((prev) => ({ ...prev, is_vegetarian: checked }))
                }
                data-testid="item-veg-switch"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <Label className="cursor-pointer">Available for ordering</Label>
              <Switch
                checked={itemForm.is_available}
                onCheckedChange={(checked) =>
                  setItemForm((prev) => ({ ...prev, is_available: checked }))
                }
                data-testid="item-available-switch"
              />
            </div>

            {/* Recipe / Preparation List */}
            <div className="space-y-3 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <FlaskConical className="w-4 h-4" /> Recipe (Preparation List)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-lg"
                  onClick={() => setItemForm((prev) => ({
                    ...prev,
                    recipe: [...prev.recipe, { inventory_item_id: '', inventory_item_name: '', quantity_needed: '', unit: '' }],
                  }))}
                  data-testid="add-ingredient-btn"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Ingredient
                </Button>
              </div>
              {itemForm.recipe.length === 0 ? (
                <p className="text-xs text-slate-400 py-2 text-center">No ingredients added. Stock will not auto-deduct on sale.</p>
              ) : (
                <div className="space-y-2">
                  {itemForm.recipe.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={ing.inventory_item_id}
                        onValueChange={(val) => {
                          const inv = inventoryItems.find(i => i.id === val);
                          const updated = [...itemForm.recipe];
                          updated[idx] = { ...updated[idx], inventory_item_id: val, inventory_item_name: inv?.name || '', unit: inv?.unit || '' };
                          setItemForm((prev) => ({ ...prev, recipe: updated }));
                        }}
                      >
                        <SelectTrigger className="h-8 rounded-lg text-xs flex-1">
                          <SelectValue placeholder="Select ingredient" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((inv) => (
                            <SelectItem key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={ing.quantity_needed}
                        onChange={(e) => {
                          const updated = [...itemForm.recipe];
                          updated[idx] = { ...updated[idx], quantity_needed: parseFloat(e.target.value) || 0 };
                          setItemForm((prev) => ({ ...prev, recipe: updated }));
                        }}
                        className="h-8 w-20 rounded-lg text-xs"
                      />
                      <span className="text-xs text-slate-400 w-8">{ing.unit}</span>
                      <button
                        onClick={() => {
                          const updated = itemForm.recipe.filter((_, i) => i !== idx);
                          setItemForm((prev) => ({ ...prev, recipe: updated }));
                        }}
                        className="text-red-400 hover:text-red-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowItemModal(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={itemLoading}
              className="bg-black hover:bg-gray-800 rounded-xl"
              data-testid="save-item-btn"
            >
              {itemLoading ? 'Saving...' : editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
