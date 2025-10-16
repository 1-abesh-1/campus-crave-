import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

function ProductList({ onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [systemSettings, setSystemSettings] = useState({
    customerCancellationTime: 10,
    deliveryPersonCancellationTime: 6
  });
  const [showCustomRequest, setShowCustomRequest] = useState(false);
  const [customRequest, setCustomRequest] = useState({
    name: '',
    description: '',
    location: '',
    deliveryCharge: 5.00
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch products
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productsData);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(productsData.map(product => product.category))];
        setCategories(uniqueCategories);
        
        // Fetch system settings
        const settingsDoc = await getDoc(doc(db, 'systemSettings', 'cancellationTimes'));
        if (settingsDoc.exists()) {
          setSystemSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter products based on search term and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = (
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (product.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const matchesCategory = selectedCategory === '' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
  };

  const toggleCustomRequest = () => {
    setShowCustomRequest(!showCustomRequest);
  };

  const handleCustomRequestChange = (e) => {
    const { name, value } = e.target;
    setCustomRequest(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCustomRequestSubmit = (e) => {
    e.preventDefault();
    
    if (!customRequest.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    // Create a custom product object
    const customProduct = {
      id: 'custom-' + Date.now(),
      name: customRequest.name,
      description: customRequest.description,
      location: customRequest.location,
      price: 0, // Price will be determined later
      deliveryCharge: parseFloat(customRequest.deliveryCharge), // Use selected delivery charge
      isCustomRequest: true,
      category: 'Custom Request'
    };
    
    // Add to cart
    onAddToCart(customProduct);
    toast.success('Custom request added to cart');
    
    // Reset form
    setCustomRequest({
      name: '',
      description: '',
      location: '',
      deliveryCharge: 5.00
    });
    
    // Close the form
    setShowCustomRequest(false);
  };

  if (loading) {
    return <div className="text-center">Loading products...</div>;
  }

  return (
    <div>
      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-grow">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 pl-10"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
          
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={handleCategoryChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          
          {(searchTerm || selectedCategory) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700"
            >
              Clear Filters
            </button>
          )}
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
        </div>
        
        {/* Display Cancellation Policy */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-700">Order Cancellation Policy</h3>
          <p className="text-sm text-blue-600 mt-1">
            • Customers have {systemSettings.customerCancellationTime} minutes to cancel an order after delivery begins
          </p>
          <p className="text-sm text-blue-600">
            • Delivery personnel have {systemSettings.deliveryPersonCancellationTime} minutes to cancel a delivery after pickup
          </p>
        </div>
        
        {/* Custom Request Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={toggleCustomRequest}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            {showCustomRequest ? 'Hide Custom Request' : 'Make Custom Request'}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 ml-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d={showCustomRequest ? "M19 9l-7 7-7-7" : "M12 4v16m8-8H4"} 
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Custom Request Form */}
      {showCustomRequest && (
        <div className="mb-6 p-4 bg-white rounded-lg shadow border-2 border-green-500">
          <h2 className="text-lg font-bold mb-4">Custom Product Request</h2>
          <form onSubmit={handleCustomRequestSubmit}>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={customRequest.name}
                onChange={handleCustomRequestChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                placeholder="Enter product name"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={customRequest.description}
                onChange={handleCustomRequestChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                placeholder="Describe what you need (size, color, brand, etc.)"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                Product Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={customRequest.location}
                onChange={handleCustomRequestChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
                placeholder="Store name or address where to find this product"
              />
            </div>
            
            {/* Delivery Charge Selection */}
            <div className="mb-4">
              <label htmlFor="deliveryCharge" className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Charge
              </label>
              <select
                id="deliveryCharge"
                name="deliveryCharge"
                value={customRequest.deliveryCharge}
                onChange={handleCustomRequestChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600"
              >
                <option value="5.00">$5.00 - Standard Delivery</option>
                <option value="10.00">$10.00 - Express Delivery</option>
                <option value="15.00">$15.00 - Priority Delivery</option>
                <option value="25.00">$25.00 - Urgent Delivery</option>
                <option value="45.00">$45.00 - Same-Day Special Delivery</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Select a delivery charge option based on your delivery needs</p>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={toggleCustomRequest}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 mr-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Add to Cart
              </button>
            </div>
            
            <div className="mt-2 text-sm text-gray-500">
              <p>* Required field</p>
              <p>Note: Product price will be determined by the seller based on the product.</p>
            </div>
          </form>
        </div>
      )}

      {filteredProducts.length === 0 && !showCustomRequest ? (
        <div className="text-center py-8">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-16 w-16 mx-auto text-gray-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <p className="text-xl font-medium text-gray-600 mt-4">No products found</p>
          <p className="text-gray-500 mt-2">Try adjusting your search or filter criteria</p>
          <button
            onClick={toggleCustomRequest}
            className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            Request a Custom Product Instead
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-48 object-cover rounded-lg"
              />
              <div className="mt-4">
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <p className="text-gray-600">{product.category}</p>
                
                {/* Display product description if available */}
                {product.description && (
                  <p className="text-gray-600 mt-2 text-sm line-clamp-3">
                    {product.description}
                  </p>
                )}
                
                <div className="flex justify-between items-center mt-3">
                  <p className="text-blue-600 font-bold">${product.price}</p>
                  <div className="text-sm text-gray-500">
                    Delivery: ${product.deliveryCharge}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    onAddToCart(product);
                    toast.success(`${product.name} added to cart`);
                  }}
                  className="btn btn-primary w-full mt-4"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductList;