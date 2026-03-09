import React, { useState, useEffect } from 'react';
import { menuAPI, uploadFile } from '../../lib/api';
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
  Plus,
  Pencil,
  Trash2,
  FolderPlus,
  Image,
  Leaf,
  Clock,
  DollarSign,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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
  });
  const [itemLoading, setItemLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

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
      });
    } else {
      setEditingItem(null);
      // Always set a valid category_id if categories exist
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
      });
    }
    setShowItemModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      setItemForm((prev) => ({ ...prev, image_url: `${API_URL}${url}` }));
      toast.success('Image uploaded');
    } catch (err) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="menu-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-slate-900">Menu Management</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCategoryModal(true)}
            data-testid="add-category-btn"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
          <Button
            onClick={() => openItemModal()}
            className="bg-orange-500 hover:bg-orange-600"
            data-testid="add-item-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={!selectedCategory ? 'default' : 'outline'}
          onClick={() => setSelectedCategory(null)}
          className={!selectedCategory ? 'bg-orange-500 hover:bg-orange-600' : ''}
        >
          All ({menuItems.length})
        </Button>
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-1">
            <Button
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat.id)}
              className={selectedCategory === cat.id ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              {cat.name} ({menuItems.filter((i) => i.category_id === cat.id).length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteCategory(cat.id)}
              className="text-slate-400 hover:text-red-500 h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Items Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden" data-testid={`menu-item-card-${item.id}`}>
              <div className="relative">
                <img
                  src={item.image_url || 'https://via.placeholder.com/300x200?text=Food'}
                  alt={item.name}
                  className="w-full h-40 object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  {item.is_vegetarian && (
                    <Badge className="bg-green-500">
                      <Leaf className="w-3 h-3" />
                    </Badge>
                  )}
                  <Badge className={item.is_available ? 'bg-green-500' : 'bg-red-500'}>
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900 mb-1">{item.name}</h3>
                {item.description && (
                  <p className="text-sm text-slate-500 mb-2 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-numbers text-xl font-bold text-orange-500">
                    ₹{item.price.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.preparation_time} min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <Switch
                    checked={item.is_available}
                    onCheckedChange={() => handleToggleAvailability(item)}
                    data-testid={`toggle-availability-${item.id}`}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openItemModal(item)}
                      data-testid={`edit-item-${item.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-red-500 hover:text-red-600"
                      data-testid={`delete-item-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-slate-400 mb-4">No menu items yet</p>
          <Button onClick={() => openItemModal()} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Item
          </Button>
        </Card>
      )}

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name *</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="e.g., Starters, Main Course"
                data-testid="category-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Optional description"
                data-testid="category-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={categoryLoading}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="save-category-btn"
            >
              {categoryLoading ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Item Image</Label>
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                {itemForm.image_url ? (
                  <div className="relative">
                    <img
                      src={itemForm.image_url}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setItemForm((prev) => ({ ...prev, image_url: '' }))}
                      className="absolute top-2 right-2 bg-white/80"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Image className="w-8 h-8 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        {uploadingImage ? 'Uploading...' : 'Click to upload image'}
                      </span>
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
                data-testid="item-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the item"
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
                  data-testid="item-price-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                {categories.length === 0 ? (
                  <p className="text-sm text-amber-600 p-2 bg-amber-50 rounded-lg">
                    Please create a category first before adding items
                  </p>
                ) : (
                  <Select
                    value={itemForm.category_id}
                    onValueChange={(val) => setItemForm((prev) => ({ ...prev, category_id: val }))}
                  >
                    <SelectTrigger data-testid="item-category-select">
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
                data-testid="item-prep-time-input"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={itemForm.is_vegetarian}
                  onCheckedChange={(checked) =>
                    setItemForm((prev) => ({ ...prev, is_vegetarian: checked }))
                  }
                  data-testid="item-veg-switch"
                />
                <Label>Vegetarian</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={itemForm.is_available}
                  onCheckedChange={(checked) =>
                    setItemForm((prev) => ({ ...prev, is_available: checked }))
                  }
                  data-testid="item-available-switch"
                />
                <Label>Available</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={itemLoading}
              className="bg-orange-500 hover:bg-orange-600"
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
