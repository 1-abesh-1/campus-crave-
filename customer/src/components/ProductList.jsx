import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom'; // Make sure this is imported
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
  // Add state for share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [productToShare, setProductToShare] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

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

  // Share product functions
  const openShareModal = (product) => {
    setProductToShare(product);
    setShowShareModal(true);
    setCopySuccess(false);
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setProductToShare(null);
    setCopySuccess(false);
  };

  const copyProductLink = () => {
    if (!productToShare) return;
    
    // Create a shareable URL with product ID
    const shareableUrl = `${window.location.origin}/product/${productToShare.id}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareableUrl)
      .then(() => {
        setCopySuccess(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopySuccess(false), 3000);
      })
      .catch(() => {
        toast.error('Failed to copy link');
      });
  };

  const shareProduct = (platform) => {
    if (!productToShare) return;
  
    const shareableUrl = `${window.location.origin}/product/${productToShare.id}`;
    const shareText = `Check out ${productToShare.name} on our store!`;
  
    let shareUrl;
  
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareableUrl}`)}`;
        break;
      case 'facebook':
        // Ensure the URL is fully encoded
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`;
        console.log("Generated Facebook Share URL:", shareUrl); // Debugging log
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareableUrl)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(`${shareText}\n\n${shareableUrl}`)}`;
        break;
      default:
        return;
    }
  
    // Open share URL in a new window or tab
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  
    // Close the modal after sharing
    closeShareModal();
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
        <div className="mt-4 p-3 rounded-lg border border-[#414833]">
          <h3 className="text-sm font-medium text-[#7f4f24]">Order Cancellation Policy</h3>
          <p className="text-sm text-[#333d29] mt-1">
            • Customers have {systemSettings.customerCancellationTime} minutes to cancel an order after delivery begins
          </p>
          <p className="text-sm text-[#333d29]">
            • Delivery personnel have {systemSettings.deliveryPersonCancellationTime} minutes to cancel a delivery after pickup
          </p>
        </div>
        
        {/* Custom Request Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={toggleCustomRequest}
            className="flex items-center px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg transition-colors"
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
        <div className="mb-6 p-4 bg-white rounded-lg shadow border-2 border-[#c9ada7]">
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
                <option value="5.00">৳5.00 - Standard Delivery</option>
                <option value="10.00">৳10.00 - Express Delivery</option>
                <option value="15.00">৳15.00 - Priority Delivery</option>
                <option value="25.00">৳25.00 - Urgent Delivery</option>
                <option value="45.00">৳45.00 - Same-Day Special Delivery</option>
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
                className="px-4 py-2 bg-[#9a8c98] hover:bg-[#9a8c98] text-white rounded-lg"
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
           {/* Make image clickable */}
           <Link to={`/product/${product.id}`}>
             <img
               src={product.imageUrl}
               alt={product.name}
               className="w-full h-48 object-cover rounded-lg"
             />
           </Link>
         
           <div className="mt-4">
             {/* Make title clickable */}
             <Link to={`/product/${product.id}`}>
               <h3 className="text-lg font-semibold hover:underline">{product.name}</h3>
             </Link>
         
             <p className="text-gray-600">{product.category}</p>
         
             {/* Display product description if available */}
             {product.description && (
  <p className="text-gray-600 mt-2 text-sm">
    {product.description.length > 100 
      ? product.description.slice(0, 100) + '...' 
      : product.description
    }
  </p>
)}

         
             <div className="flex justify-between items-center mt-3">
               <p className="font-bold" style={{ color: '#656d4a' }}>
                 ৳{product.price}
               </p>
               <div className="text-sm" style={{ color: '#656d4a' }}>
                 Delivery: ৳{product.deliveryCharge}
               </div>
             </div>
         
             <div className="flex gap-2 mt-4">
               <button
                 onClick={() => {
                   onAddToCart(product);
                   toast.success(`${product.name} added to cart`);
                 }}
                 className="btn btn-primary flex-grow"
                 style={{ backgroundColor: '#22333b', color: 'white' }}
               >
                 Add to Cart
               </button>
         
               {/* Share Button */}
               <button
                 onClick={() => openShareModal(product)}
                 className="btn w-10 h-10 flex items-center justify-center rounded-lg"
                 style={{ backgroundColor: '#4a5759', color: 'white' }}
                 aria-label="Share product"
               >
                 <svg
                   xmlns="http://www.w3.org/2000/svg"
                   className="h-5 w-5"
                   fill="none"
                   viewBox="0 0 24 24"
                   stroke="currentColor"
                 >
                   <path
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     strokeWidth={2}
                     d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                   />
                 </svg>
               </button>
             </div>
           </div>
         </div>
         
          ))}
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && productToShare && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Share Product</h3>
              <button 
                onClick={closeShareModal} 
                className="text-gray-500 hover:text-gray-700"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex items-center space-x-3 mb-2">
                <img 
                  src={productToShare.imageUrl} 
                  alt={productToShare.name} 
                  className="w-16 h-16 object-cover rounded"
                />
                <div>
                  <h4 className="font-medium">{productToShare.name}</h4>
                  <p className="text-sm text-gray-600">{productToShare.category}</p>
                </div>
              </div>
            </div>
            
            {/* Share options */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button 
                onClick={() => shareProduct('whatsapp')} 
                className="flex items-center justify-center p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
              <button 
                onClick={() => shareProduct('facebook')} 
                className="flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
              <button 
                onClick={() => shareProduct('twitter')} 
                className="flex items-center justify-center p-3 bg-blue-400 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.937 4.937 0 004.604 3.417 9.868 9.868 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.054 0 13.999-7.496 13.999-13.986 0-.209 0-.42-.015-.63a9.936 9.936 0 002.46-2.548l-.047-.02z"/>
                </svg>
                Twitter
              </button>
              <button 
                onClick={() => shareProduct('email')} 
                className="flex items-center justify-center p-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </button>
            </div>
            
            {/* Copy Link Section */}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Or copy link</p>
              <div className="flex">
                <button
                  onClick={copyProductLink}
                  className={`flex-grow px-4 py-2 ${copySuccess ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'} border rounded-lg transition-colors flex items-center justify-center`}
                >
                  {copySuccess ? (
                    <>
                      <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductList;