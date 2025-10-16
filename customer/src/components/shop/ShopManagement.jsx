import { useState, useEffect } from 'react';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {onSnapshot,deleteDoc, collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PlusCircle, Store, Package, Edit3, Trash2, AlertCircle, CheckCircle, TruckIcon, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import ShopPaymentStatus from './ShopPaymentStatus';

const ShopManagement = () => {
  const { currentUser } = useAuth();
  const [currentShop, setCurrentShop] = useState(null);
  
  const [activeTab, setActiveTab] = useState('myShop');
  const [shop, setShop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [shopForm, setShopForm] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    logo: null,
    logoUrl: '',
    banner: null,
    bannerUrl: '',
    categories: [],
    deliveryOptions: {
      selfDelivery: true,
      platformDelivery: false
    }
  });
  const [newCategory, setNewCategory] = useState('');
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image: null,
    imageUrl: '',
    stock: '',
    deliveryCharge: '',
    selfDelivery: true,
    platformDelivery: false,
    location: '' // ✅ Add this
  });
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [shopStats, setShopStats] = useState({
    totalProducts: 0,
    pendingApproval: 0,
    totalOrders: 0,
    totalRevenue: 0
  });
  const [shopOrders, setShopOrders] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);




  useEffect(() => {
    if (!shop?.id) return;
  
    const fetchOrders = async () => {
      try {
        const snapshot = await getDocs(collection(db, "orders"));
        const matchedOrders = [];
        let totalRevenue = 0;
  
        snapshot.forEach((doc) => {
          const data = doc.data();
          const items = data.items || [];
  
          const shopItems = items.filter(item => item.shopId === shop.id);
  
          if (shopItems.length > 0) {
            matchedOrders.push({ id: doc.id, ...data });
  
            // ✅ Only add revenue if order is completed
            if (data.status === "completed") {
              shopItems.forEach(item => {
                totalRevenue += Number(item.price) || 0;
              });
            }
          }
        });
  
        setShopOrders(matchedOrders);
        setShopStats({
          totalProducts: shopStats.totalProducts,
          pendingApproval: shopStats.pendingApproval,
          totalOrders: matchedOrders.length,
          totalRevenue: totalRevenue,
        });
  
      } catch (err) {
        console.error("Error fetching shop orders:", err);
      }
    };
  
    fetchOrders();
  });
  

  const deleteProduct = async (productId, isSubmission = false) => {
    const collectionName = isSubmission ? 'productSubmissions' : 'products';
    const confirmDelete = confirm('Are you sure you want to delete this product?');
    if (!confirmDelete) return;
  
    try {
      await deleteDoc(doc(db, collectionName, productId));
      toast.success('Product deleted successfully');
      await fetchShopProducts(shop.id); // refresh list
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
    }
  };
  
  useEffect(() => {
    fetchShopData();
  }, [currentUser]);

  useEffect(() => {
    if (shop && activeTab === 'orders') {
      fetchShopOrders();
      
      // Set up realtime listener for shop orders
      const shopOrdersQuery = query(
        collection(db, 'orders'),
        where('shopId', '==', shop.id),
        where('status', 'in', ['pending', 'in_progress', 'delivered'])
      );
      
      const unsubscribe = onSnapshot(shopOrdersQuery, (snapshot) => {
        fetchShopOrders();
      });
      
      return () => unsubscribe();
    }
  }, [shop, activeTab]);

  const fetchShopOrders = async () => {
    if (!shop) return;
    
    try {
      const shopOrdersQuery = query(
        collection(db, 'orders'),
        where('shopId', '==', shop.id),
        where('status', 'in', ['pending', 'in_progress', 'delivered'])
      );
      
      const ordersSnapshot = await getDocs(shopOrdersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setShopOrders(ordersData);
    } catch (error) {
      console.error('Error fetching shop orders:', error);
      toast.error('Failed to load shop orders');
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updates = {
        status: newStatus
      };
      
      if (newStatus === 'in_progress') {
        updates.deliveryPersonId = currentUser.uid;
        updates.deliveryStartTime = serverTimestamp();
        updates.selfDelivery = true; // Mark as self-delivery by shop owner
      }
      
      await updateDoc(orderRef, updates);
      toast.success(`Order marked as ${newStatus}`);
      fetchShopOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  const fetchShopData = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      const shopsRef = collection(db, 'shops');
      const q = query(shopsRef, where('ownerId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const shopData = querySnapshot.docs[0].data();
        setShop({
          id: querySnapshot.docs[0].id,
          ...shopData
        });
        
        // Fetch products for this shop
        await fetchShopProducts(querySnapshot.docs[0].id);
        
        // Fetch shop statistics
        await fetchShopStatistics(querySnapshot.docs[0].id);
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
      toast.error('Failed to load shop data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShopProducts = async (shopId) => {
    try {
      const productsRef = collection(db, 'products');
      const productSubsRef = collection(db, 'productSubmissions');
  
      const [productsSnap, subsSnap] = await Promise.all([
        getDocs(query(productsRef, where('shopId', '==', shopId))),
        getDocs(query(productSubsRef, where('shopId', '==', shopId), where('status', 'in', ['pending', 'rejected'])))
      ]);
  
      const allProducts = [
        ...productsSnap.docs.map(doc => ({ id: doc.id, isSubmission: false, ...doc.data() })),
        ...subsSnap.docs.map(doc => ({ id: doc.id, isSubmission: true, ...doc.data() }))
      ];
  
      setProducts(allProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    }
  };
  

  const fetchShopStatistics = async (shopId) => {
    try {
      // Fetch total products count
      const productsRef = collection(db, 'products');
      const productsQuery = query(productsRef, where('shopId', '==', shopId));
      const productsSnapshot = await getDocs(productsQuery);
      
      // Count pending approval products
      const pendingProducts = productsSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
      
      // Fetch orders for this shop
      const ordersRef = collection(db, 'orders');
      const ordersQuery = query(ordersRef, where('shopId', '==', shopId));
      const ordersSnapshot = await getDocs(ordersQuery);
      
      // Calculate total revenue
      const totalRevenue = ordersSnapshot.docs.reduce((sum, doc) => {
        const orderData = doc.data();
        return orderData.status === 'completed' ? sum + (orderData.total || 0) : sum;
      }, 0);
      
      setShopStats({
        totalProducts: productsSnapshot.docs.length,
        pendingApproval: pendingProducts,
        totalOrders: ordersSnapshot.docs.length,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching shop statistics:', error);
    }
  };

  const handleShopFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
  
    if (type === 'file') {
      if (files && files[0]) {
        const previewUrl = URL.createObjectURL(files[0]);
        setShopForm(prev => ({
          ...prev,
          [name]: files[0],
          [`${name}Url`]: previewUrl
        }));
      }
    } else if (type === 'url') {
      // Handle URL input explicitly
      setShopForm(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (name.startsWith('deliveryOptions.')) {
      const optionName = name.split('.')[1];
      setShopForm(prev => ({
        ...prev,
        deliveryOptions: {
          ...prev.deliveryOptions,
          [optionName]: checked
        }
      }));
    } else {
      setShopForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  

  const handleProductFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
  
    if (type === 'file') {
      if (files && files[0]) {
        const previewUrl = URL.createObjectURL(files[0]);
        setProductForm(prev => ({
          ...prev,
          [name]: files[0],
          [`${name}Url`]: previewUrl
        }));
      }
    } else if (type === 'url') {
      setProductForm(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (type === 'checkbox') {
      setProductForm(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setProductForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  

  const handleAddCategory = () => {
    if (newCategory.trim() === '') return;
    
    if (!shopForm.categories.includes(newCategory.trim())) {
      setShopForm(prev => ({
        ...prev,
        categories: [...prev.categories, newCategory.trim()]
      }));
      setNewCategory('');
    } else {
      toast.error('This category already exists');
    }
  };

  const handleRemoveCategory = (category) => {
    setShopForm(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat !== category)
    }));
  };

  const uploadFileToStorage = async (file, path) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleCreateShop = async () => {
    if (!shopForm.name || !shopForm.description || !shopForm.address) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      
      // Upload logo if provided
      
      
      // Create shop document
      const shopData = {
        name: shopForm.name,
        description: shopForm.description,
        address: shopForm.address,
        phone: shopForm.phone,
        logoUrl:shopForm.logoUrl,
        bannerUrl:shopForm.bannerUrl,
        categories: shopForm.categories,
        deliveryOptions: shopForm.deliveryOptions,
        ownerId: currentUser.uid,
        ownerEmail: currentUser.email,
        status: 'pending', // Pending admin approval
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const shopRef = await addDoc(collection(db, 'shops'), shopData);
      
      toast.success('Shop created successfully and is pending approval');
      setShop({
        id: shopRef.id,
        ...shopData,
        status: 'pending'
      });
      setIsCreatingShop(false);
    } catch (error) {
      console.error('Error creating shop:', error);
      toast.error('Failed to create shop');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateShop = async () => {
    if (!shop || !shop.id) return;
    
    setIsLoading(true);
    try {
      let updates = {
        name: shopForm.name,
        description: shopForm.description,
        address: shopForm.address,
        phone: shopForm.phone,
        categories: shopForm.categories,
        deliveryOptions: shopForm.deliveryOptions,
        location: productForm.location,

        updatedAt: serverTimestamp(),
        logoUrl:shopForm.logoUrl,
bannerUrl:shopForm.bannerUrl,
      };

      
      // Update shop document
      await updateDoc(doc(db, 'shops', shop.id), updates);
      
      // Update local state
      setShop(prev => ({
        ...prev,
        ...updates
      }));
      
      toast.success('Shop updated successfully');
      setIsCreatingShop(false);
    } catch (error) {
      console.error('Error updating shop:', error);
      toast.error('Failed to update shop');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditShop = () => {
    if (!shop) return;
    
    setShopForm({
      name: shop.name || '',
      description: shop.description || '',
      address: shop.address || '',
      phone: shop.phone || '',
      logo: null,
      logoUrl: shop.logoUrl || '',
      banner: null,
      bannerUrl: shop.bannerUrl || '',
      categories: shop.categories || [],
      deliveryOptions: shop.deliveryOptions || {
        selfDelivery: true,
        platformDelivery: true,
      }
    });
    
    setIsCreatingShop(true);
  };

  const handleAddProduct = async () => {
    if (!shop || shop.status !== 'approved') {
      toast.error('Your shop must be approved before adding products');
      return;
    }
    
    if (!productForm.name || !productForm.price || !productForm.category) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);
    try {
      
      // Upload product image if provided
     
      
      // Create product document
      const productData = {
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        category: productForm.category,
        imageUrl:productForm.imageUrl,
        stock: parseInt(productForm.stock) || 0,
        deliveryCharge: parseFloat(productForm.deliveryCharge) || 0,
        selfDelivery: productForm.selfDelivery,
        platformDelivery: productForm.platformDelivery,
        shopId: shop.id,
        location: productForm.location,
        shopName: shop.name,
        status: 'pending', // Pending admin approval
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'productSubmissions'), productData);
      
      toast.success('Product added successfully and is pending approval');
      setIsAddingProduct(false);
      setProductForm({
        name: '',
        description: '',
        price: '',
        category: '',
        image: null,
        imageUrl: '',
        stock: '',
        deliveryCharge: '',
        selfDelivery: true,
        platformDelivery: false
      });
      
      // Refresh products list
      await fetchShopProducts(shop.id);
      await fetchShopStatistics(shop.id);
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
  
    setIsLoading(true);
    try {
      const updates = {
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        category: productForm.category,
        stock: parseInt(productForm.stock) || 0,
        imageUrl: productForm.imageUrl,
        deliveryCharge: parseFloat(productForm.deliveryCharge) || 0,
        selfDelivery: productForm.selfDelivery,
        platformDelivery: productForm.platformDelivery,
        status: 'pending', // Reset status for re-approval
        updatedAt: serverTimestamp()
      };
  
      const productRef = doc(db, 'products', editingProduct.id);
      const productSubmissionRef = doc(db, 'productSubmissions', editingProduct.id);
  
      // Check which collection the product belongs to
      const docSnap = await getDoc(productRef);
      if (docSnap.exists()) {
        await updateDoc(productRef, updates);
      } else {
        await updateDoc(productSubmissionRef, updates);
      }
  
      toast.success('Product updated successfully and is pending approval');
  
      setIsAddingProduct(false);
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        price: '',
        category: '',
        image: null,
        imageUrl: '',
        stock: '',
        location:'',
        deliveryCharge: '',
        selfDelivery: true,
        platformDelivery: false
      });
  
      await fetchShopProducts(shop.id);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditProduct = (product) => {
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      category: product.category || '',
      location:product.location,
      imageUrl: product.imageUrl || '',
      stock: product.stock?.toString() || '',
      deliveryCharge: product.deliveryCharge?.toString() || '',
      selfDelivery: product.selfDelivery ?? true,
      platformDelivery: product.platformDelivery ?? false
    });
    
    setEditingProduct(product);
    setIsAddingProduct(true);
  };

  const renderShopCreateForm = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">
          {shop ? 'Update Your Shop' : 'Create Your Shop'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shop Name*
            </label>
            <input
              type="text"
              name="name"
              value={shopForm.name}
              onChange={handleShopFormChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Enter your shop name"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description*
            </label>
            <textarea
              name="description"
              value={shopForm.description}
              onChange={handleShopFormChange}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Describe your shop (products, specialties, etc.)"
              required
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address*
            </label>
            <input
              type="text"
              name="address"
              value={shopForm.address}
              onChange={handleShopFormChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Shop address"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={shopForm.phone}
              onChange={handleShopFormChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Contact phone number"
            />
          </div>
          
          <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Shop Logo URL
  </label>
  <input
    type="url"
    name="logoUrl"
    placeholder="Enter logo image URL"
    value={shopForm.logoUrl || ''}
    onChange={handleShopFormChange}
    className="w-full p-2 border border-gray-300 rounded-lg"
  />
  {shopForm.logoUrl && (
    <div className="mt-2">
      <img
        src={shopForm.logoUrl}
        alt="Shop logo preview"
        className="h-20 w-20 object-cover rounded-lg"
      />
    </div>
  )}
</div>

<div className="mt-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Shop Banner URL
  </label>
  <input
    type="url"
    name="bannerUrl"
    placeholder="Enter banner image URL"
    value={shopForm.bannerUrl || ''}
    onChange={handleShopFormChange}
    className="w-full p-2 border border-gray-300 rounded-lg"
  />
  {shopForm.bannerUrl && (
    <div className="mt-2">
      <img
        src={shopForm.bannerUrl}
        alt="Shop banner preview"
        className="h-24 w-full object-cover rounded-lg"
      />
    </div>
  )}
</div>
      
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Categories
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {shopForm.categories.map((category, index) => (
                <div key={index} className="bg-[#e9edc9] text-[#656d4a] px-3 py-1 rounded-full text-sm flex items-center">
                  {category}
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(category)}
                    className="ml-2 text-[#656d4a] hover:text-[#333d29]"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-grow px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
                placeholder="Add a category"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-r-lg"
              >
                Add
              </button>
            </div>
          </div>
          
      
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => setIsCreatingShop(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={shop ? handleUpdateShop : handleCreateShop}
            className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : shop ? 'Update Shop' : 'Create Shop'}
          </button>
        </div>
      </div>
    );
  };

  const renderProductForm = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">
          {editingProduct ? 'Update Product' : 'Add New Product'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name*
            </label>
            <input
              type="text"
              name="name"
              value={productForm.name}
              onChange={handleProductFormChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Enter product name"
              required
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={productForm.description}
              onChange={handleProductFormChange}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Describe your product"
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price*
            </label>
            <input
              type="number"
              name="price"
              value={productForm.price}
              onChange={handleProductFormChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Product price"
              required
            />
          </div>
          <div className="md:col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Pickup Address
  </label>
  <input
    type="text"
    name="location"
    value={productForm.location}
    onChange={handleProductFormChange}
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
    placeholder="Enter pickup address"
  />

</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category*
            </label>
            <select
              name="category"
              value={productForm.category}
              onChange={handleProductFormChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              required
            >
              <option value="">Select a category</option>
              {shop.categories.map((category, index) => (
                <option key={index} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Quantity
            </label>
            <input
              type="number"
              name="stock"
              value={productForm.stock}
              onChange={handleProductFormChange}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Available quantity"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Charge
            </label>
            <input
              type="number"
              name="deliveryCharge"
              value={productForm.deliveryCharge}
              onChange={handleProductFormChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-olive-600 focus:border-olive-600"
              placeholder="Delivery fee"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Image
            </label>
            <input
  type="url"
  name="imageUrl"
  value={productForm.imageUrl}
  onChange={handleProductFormChange}
  className="w-full p-2 border border-gray-300 rounded-lg"
/>

            {productForm.imageUrl && (
              <div className="mt-2">
                <img
                  src={productForm.imageUrl}
                  alt="Product image preview"
                  className="h-40 w-40 object-cover rounded-lg"
                />
              </div>
            )}
          </div>
          
          
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => {
              setIsAddingProduct(false);
              setEditingProduct(null);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={editingProduct ? handleUpdateProduct : handleAddProduct}
            className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg"
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : editingProduct ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </div>
    );
  };

  const renderShopDashboard = () => {
    return (
      <div className="space-y-6">
        {shop && shop.status === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start">
            <AlertCircle className="text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Shop Pending Approval</h3>
              <p className="text-yellow-700 text-sm mt-1">
                Your shop is currently under review. You'll be able to add products once approved.
              </p>
            </div>
          </div>
        )}
        
        {shop && shop.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start">
            <AlertCircle className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Shop Approval Rejected</h3>
              <p className="text-red-700 text-sm mt-1">
                Your shop approval was rejected. Please update your shop information and try again.
              </p>
            </div>
          </div>
        )}
        
        {shop && shop.status === 'approved' && (
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start">
            <CheckCircle className="text-green-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-green-800">Shop Approved</h3>
              <p className="text-green-700 text-sm mt-1">
                Your shop is approved and active. You can now add products and manage your shop.
              </p>
            </div>
          </div>
        )}
  
        {/* Payment Status Component */}
        {shop && shop.utilityFeePayment && (
  <ShopPaymentStatus shop={shop}  refetchShop={fetchShopData} />
)}

        
        {shop && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/4 mb-4 md:mb-0 md:pr-6">
                {shop.logoUrl ? (
                  <img
                    src={shop.logoUrl}
                    alt={shop.name}
                    className="w-32 h-32 object-cover rounded-lg mx-auto md:mx-0"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center mx-auto md:mx-0">
                    <Store className="h-10 w-10 text-gray-400" />
                  </div>
                )}
              </div>
              
              <div className="md:w-3/4">
                <div className="flex justify-between items-start">
                  <h3 className="text-2xl font-bold">{shop.name}</h3>
                  <button
                    onClick={handleEditShop}
                    className="text-[#656d4a] hover:text-[#414833] flex items-center"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit Shop
                  </button>
                </div>
                
                <p className="text-gray-600 mt-2">{shop.description}</p>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Address:</p>
                    <p className="text-sm">{shop.address}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Contact:</p>
                    <p className="text-sm">{shop.phone || 'Not provided'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Status:</p>
                    <span className={`text-sm px-2 py-0.5 rounded ${
                      shop.status === 'approved' ? 'bg-green-100 text-green-800' :
                      shop.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {shop.status === 'approved' ? 'Approved' :
                       shop.status === 'pending' ? 'Pending Approval' :
                       'Rejected'}
                    </span>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Delivery Options:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {shop.deliveryOptions?.selfDelivery && (
                        <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-xs">
                          Self-delivery
                        </span>
                      )}
                      {shop.deliveryOptions?.platformDelivery && (
                        <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-xs">
                          Platform delivery
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#fefae0] p-4 rounded-lg">
                <h4 className="text-[#656d4a] text-sm font-medium">Total Products</h4>
                <p className="text-2xl font-bold mt-1">{shopStats.totalProducts}</p>
              </div>
              
              <div className="bg-[#fefae0] p-4 rounded-lg">
                <h4 className="text-[#656d4a] text-sm font-medium">Pending Approval</h4>
                <p className="text-2xl font-bold mt-1">{shopStats.pendingApproval}</p>
              </div>
              
              <div className="bg-[#fefae0] p-4 rounded-lg">
                <h4 className="text-[#656d4a] text-sm font-medium">Total Orders</h4>
                <p className="text-2xl font-bold mt-1">{shopStats.totalOrders}</p>
              </div>
              
              <div className="bg-[#fefae0] p-4 rounded-lg">
                <h4 className="text-[#656d4a] text-sm font-medium">Total Revenue</h4>
                <p className="text-2xl font-bold mt-1">৳{shopStats.totalRevenue}</p>
              </div>
            </div>
          </div>
        )}
        
        {!shop && (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">You don't have a shop yet</h3>
            <p className="text-gray-600 mb-4">Create your shop to start selling products and earn money.</p>
            <button
              onClick={() => setIsCreatingShop(true)}
              className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg flex items-center mx-auto"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Create Your Shop
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderShopOrders = () => {
    if (!shop) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Shop Found</h3>
          <p className="text-gray-600 mb-4">You need to create a shop before you can view orders.</p>
          <button
            onClick={() => {
              setActiveTab('myShop');
              setIsCreatingShop(true);
            }}
            className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg flex items-center mx-auto"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Your Shop
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Active Orders for Your Shop</h2>
        
        {shopOrders.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Active Orders</h3>
            <p className="text-gray-600 mb-4">
              There are currently no active orders for your shop.
            </p>
          </div>
        ) : (
          shopOrders.map((order) => (
            <div key={order.id} className={`bg-white p-6 rounded-lg shadow-md ${
              order.status === 'in_progress' && order.deliveryPersonId === currentUser.uid ? 
              'border-2 border-green-500' : ''
            }`}>
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="space-y-3 w-full md:w-2/3">
                  {order.status === 'in_progress' && order.deliveryPersonId === currentUser.uid && (
                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium inline-block">
                      You're delivering this order
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500">Order ID: {order.id}</p>
                  <p className="text-sm text-gray-500 break-words">
  Date: {(() => {
    try {
      if (!order.createdAt) return 'N/A';
      if (typeof order.createdAt.toDate === 'function') {
        return order.createdAt.toDate().toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      if (order.createdAt.seconds) {
        return new Date(delivery.createdAt.seconds * 1000).toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      return new Date(order.createdAt).toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Invalid Date';
    }
  })()}
</p>
                  <p className="text-sm text-gray-500">
                    Status: <span className="font-medium">{order.status}</span>
                  </p>
                  
                  <div className="bg-blue-50 p-3 rounded-md">
                    <h3 className="font-medium text-blue-800 mb-2">Customer Details:</h3>
                    <p className="text-sm">
                      <span className="font-semibold">Contact:</span> {order.contactNumber || 'Not provided'}
                    </p>
                    <div className="mt-1">
                      <span className="font-semibold text-sm">Delivery Address:</span> 
                      <p className="text-sm mt-1 whitespace-pre-line">
                        {order.deliveryLocation || order.location || 'Not provided'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="font-medium mb-2">Items:</h3>
                    <ul className="space-y-2">
                      {(order.items || []).map((item, index) => (
                        <li key={index} className="text-sm">
                          {item.name} x{item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 w-full md:w-auto">
                  {order.status === 'pending' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'in_progress')}
                      className="btn btn-secondary w-full md:w-40"
                    >
                      Self-Deliver
                    </button>
                  )}
                  
                  {order.status === 'in_progress' && order.deliveryPersonId === currentUser.uid && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      className="btn btn-primary w-full md:w-40"
                    >
                      Mark as Delivered
                    </button>
                  )}
                  
                  {order.status === 'delivered' && order.deliveryPersonId === currentUser.uid && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      className="btn btn-green w-full md:w-40"
                      disabled={!order.customerConfirmed}
                    >
                      Confirm Delivery
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderProducts = () => {
    if (!shop) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Shop Found</h3>
          <p className="text-gray-600 mb-4">You need to create a shop before adding products.</p>
          <button
            onClick={() => {
              setActiveTab('myShop');
              setIsCreatingShop(true);
            }}
            className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg flex items-center mx-auto"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Your Shop
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {shop.status === 'approved' && (
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Your Products</h3>
            <button
              onClick={() => setIsAddingProduct(true)}
              className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg flex items-center"
              disabled={shop.status !== 'approved'}
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Add New Product
            </button>
          </div>
        )}
        
        {products.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Products Yet</h3>
            <p className="text-gray-600 mb-4">
              {shop.status === 'approved' 
                ? 'Start adding products to your shop inventory.' 
                : 'You can add products once your shop is approved.'}
            </p>
            {shop.status === 'approved' && (
              <button
                onClick={() => setIsAddingProduct(true)}
                className="px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg flex items-center mx-auto"
              >
                <PlusCircle className="h-5 w-5 mr-2" />
                Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map(product => (
              <div key={product.id} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="relative">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Package className="h-10 w-10 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      product.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {product.status === 'rejected' ? 'Rejected' :
                       product.status === 'pending' ? 'Pending' :
                       'Approved'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h3 className="text-lg font-semibold">{product.name}</h3>
                  <p className="text-gray-600">{product.category}</p>
                  
                  {product.description && (
                    <p className="text-gray-600 mt-2 text-sm line-clamp-3">
                      {product.description}
                    </p>
                  )}
                  {product.location && (
  <p className="text-sm text-gray-500 mt-1">Pickup: {product.location}</p>
)}

                  
                  <div className="flex justify-between items-center mt-3">
                    <p className="font-bold text-[#656d4a]">৳{product.price?.toFixed(2)}</p>
                    <div className="text-sm text-[#656d4a]">
                      Stock: {product.stock || 'N/A'}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-3">
                    {product.selfDelivery && (
                      <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-xs flex items-center">
                        <ShoppingBag className="h-3 w-3 mr-1" />
                        Self-delivery
                      </span>
                    )}
                    {product.platformDelivery && (
                      <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-xs flex items-center">
                        <TruckIcon className="h-3 w-3 mr-1" />
                        Platform delivery
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="flex-1 px-3 py-2 bg-[#d4a373] hover:bg-[#bc6c25] text-white rounded-lg flex items-center justify-center"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        deleteProduct(product.id, product.isSubmission)
                      }}
                      className="px-3 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Shop Management</h2>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('myShop')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'myShop'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            My Shop
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'products'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'orders'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Orders
          </button>
        </nav>
      </div>
      
      {/* Content based on active tab */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#656d4a]"></div>
          <p className="mt-2 text-gray-500">Loading...</p>
        </div>
      ) : (
        <>
          {isCreatingShop ? (
            renderShopCreateForm()
          ) : isAddingProduct ? (
            renderProductForm()
          ) : (
            <>
              {activeTab === 'myShop' && renderShopDashboard()}
              {activeTab === 'products' && renderProducts()}
              {activeTab === 'orders' && renderShopOrders()}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ShopManagement;