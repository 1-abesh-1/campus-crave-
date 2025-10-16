import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import DeliveryTracker from './DeliveryTracker';
import PaymentStats from './PaymentStats';
import MonthlyStats from './MonthlyStats';
import DeliveryPersonnelManagement from './DeliveryPersonnelManagement';
import ShopApprovalManager from './shop/ShopApprovalManager';
import ProductApprovalManager from './shop/ProductApprovalManager';
import { Store, Package, Settings, BarChart2 } from 'lucide-react';

function AdminPanel() {
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    imageUrl: '',
    location: '',
    deliveryCharge: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [systemSettings, setSystemSettings] = useState({
    customerCancellationTime: 10,
    deliveryPersonCancellationTime: 6,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
    }
    fetchSystemSettings();
  }, [activeTab]);

  const fetchSystemSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'systemSettings', 'cancellationTimes'));
      if (settingsDoc.exists()) {
        setSystemSettings(settingsDoc.data());
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
      toast.error('Failed to load system settings');
    }
  };

  const updateSystemSettings = async () => {
    try {
      setSettingsLoading(true);
      await setDoc(doc(db, 'systemSettings', 'cancellationTimes'), systemSettings, { merge: true });
      toast.success('System settings updated successfully!');
    } catch (error) {
      console.error('Error updating system settings:', error);
      toast.error('Failed to update system settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      await addDoc(collection(db, 'products'), {
        name: formData.name,
        price: parseFloat(formData.price),
        category: formData.category,
        imageUrl: formData.imageUrl,
        location: formData.location,
        deliveryCharge: parseFloat(formData.deliveryCharge),
        description: formData.description,
        status: 'approved',
      });

      toast.success('Product added successfully!');
      setFormData({ 
        name: '', 
        price: '', 
        category: '', 
        imageUrl: '', 
        location: '',
        deliveryCharge: '',
        description: '',
      });
      fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      toast.success('Product deleted successfully!');
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setSystemSettings(prev => ({
      ...prev,
      [name]: parseInt(value)
    }));
  };

  const filteredProducts = products.filter(product => {
    return (
      product.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
  });

  const renderDashboardTab = () => {
    return (
      <>
      <MonthlyStats/>
        <DeliveryTracker isAdmin="true" />
      </>
    );
  };

  const renderApprovalTab = () => {
    return (
      <>
        <ShopApprovalManager />
        <div className="mt-6">
          <ProductApprovalManager />
        </div>
      </>
    );
  };

  const renderProductsTab = () => {
    return (
      <>
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Add New Product</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Product Name
              </label>
              <input
                type="text"
                name="name"
                required
                className="input mt-1"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Price
              </label>
              <input
                type="number"
                name="price"
                step="0.01"
                required
                className="input mt-1"
                value={formData.price}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Delivery Charge
              </label>
              <input
                type="number"
                name="deliveryCharge"
                step="0.01"
                required
                className="input mt-1"
                value={formData.deliveryCharge}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                name="category"
                required
                className="input mt-1"
                value={formData.category}
                onChange={handleChange}
              >
                <option value="">Select category</option>
                <option value="Food">Food</option>
                <option value="Drinks">Drinks</option>
                <option value="Snacks">Snacks</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Image URL
              </label>
              <input
                type="url"
                name="imageUrl"
                required
                className="input mt-1"
                value={formData.imageUrl}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Google Maps Location
              </label>
              <input
                type="text"
                name="location"
                required
                className="input mt-1"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter Google Maps URL"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                className="input mt-1"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Enter product description"
              ></textarea>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Adding Product...' : 'Add Product'}
            </button>
          </form>
        </div>

        <div className="card mt-6">
          <h2 className="text-xl font-bold mb-4">Product List</h2>
          
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search products..."
              className="input w-full"
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="space-y-4">
            {filteredProducts.length === 0 ? (
              <p className="text-gray-500">No products found</p>
            ) : (
              filteredProducts.map((product) => (
                <div key={product.id} className="flex justify-between items-center p-4 border rounded">
                  <div>
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-sm text-gray-500">৳{product.price} - {product.category}</p>
                    {product.description && (
                      <p className="text-sm mt-1">{product.description.substring(0, 60)}...</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="btn btn-secondary text-red-600"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    );
  };

  const renderSettingsTab = () => {
    return (
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Cancellation Time Settings</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Customer Cancellation Window (minutes)
            </label>
            <input
              type="number"
              name="customerCancellationTime"
              required
              min="1"
              max="60"
              className="input mt-1"
              value={systemSettings.customerCancellationTime}
              onChange={handleSettingsChange}
            />
            <p className="text-sm text-gray-500 mt-1">Time window for customers to cancel an order after delivery starts</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Delivery Person Cancellation Window (minutes)
            </label>
            <input
              type="number"
              name="deliveryPersonCancellationTime"
              required
              min="1"
              max="60"
              className="input mt-1"
              value={systemSettings.deliveryPersonCancellationTime}
              onChange={handleSettingsChange}
            />
            <p className="text-sm text-gray-500 mt-1">Time window for delivery personnel to cancel a delivery after pickup</p>
          </div>

          <button
            type="button"
            onClick={updateSystemSettings}
            className="btn btn-primary w-full"
            disabled={settingsLoading}
          >
            {settingsLoading ? 'Updating Settings...' : 'Update Settings'}
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap space-x-4 md:space-x-8">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm ${
              activeTab === 'dashboard'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BarChart2 className="h-5 w-5 mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm ${
              activeTab === 'approvals'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Store className="h-5 w-5 mr-2" />
            Shop & Product Approvals
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm ${
              activeTab === 'products'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Package className="h-5 w-5 mr-2" />
            Manage Products
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm ${
              activeTab === 'settings'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings className="h-5 w-5 mr-2" />
            Settings
          </button>
        </nav>
      </div>
      
      {/* Content based on active tab */}
      {activeTab === 'dashboard' && renderDashboardTab()}
      {activeTab === 'approvals' && renderApprovalTab()}
      {activeTab === 'products' && renderProductsTab()}
      {activeTab === 'settings' && renderSettingsTab()}
      
      {/* Add the Delivery Personnel Management component */}
      {activeTab === 'dashboard' && <DeliveryPersonnelManagement />}
    </div>
  );
}

export default AdminPanel;