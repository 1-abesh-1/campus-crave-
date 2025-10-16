import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

function Product({ onAddToCart }) {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Fetch product details when component mounts
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const productDoc = await getDoc(doc(db, 'products', productId));
        
        if (productDoc.exists()) {
          setProduct({
            id: productDoc.id,
            ...productDoc.data()
          });
        } else {
          toast.error('Product not found');
          navigate('/'); // Redirect to home page if product doesn't exist
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, navigate]);
 
  const handleQuantityChange = (e) => {
    let value = parseInt(e.target.value, 10);
  
    if (isNaN(value)) return; // prevent NaN errors
  
    if (value < 1) {
      value = 1;
    } else if (value > 10) {
      value = 10;
    }
  
    setQuantity(value);
  };
  
  const incrementQuantity = () => {
    setQuantity(prev => (prev < 10 ? prev + 1 : 10));
  };
  
  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  const handleAddToCart = () => {
    if (product && onAddToCart) {
      try {
        // Create a new object with only the necessary properties to avoid circular references
        const cartItem = {
          id: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          category: product.category,
          deliveryCharge: product.deliveryCharge,
          quantity: quantity
        };
        
        // Call the parent component's onAddToCart function
        onAddToCart(cartItem);
        toast.success(`${product.name} added to cart`);
      } catch (error) {
        console.error('Error adding to cart:', error);
        toast.error('Failed to add item to cart');
      }
    } else if (!onAddToCart) {
      console.error('onAddToCart function is not available');
      toast.error('Unable to add to cart. Please try again later.');
    }
  };

  // Share functionality
  const openShareModal = () => {
    setShowShareModal(true);
    setCopySuccess(false);
  };

  const closeShareModal = () => {
    setShowShareModal(false);
    setCopySuccess(false);
  };

  const copyProductLink = () => {
    // Create a shareable URL
    const shareableUrl = window.location.href;
    
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
    const shareableUrl = window.location.href;
    const shareText = product ? `Check out ${product.name} on our store!` : 'Check out this product!';
    
    let shareUrl;
    
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareableUrl)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareableUrl)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareText + '\n\n' + shareableUrl)}`;
        break;
      default:
        return;
    }
    
    // Open share URL in new window
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
    
    // Close modal after sharing
    closeShareModal();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#656d4a] border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
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
          <h2 className="text-2xl font-bold text-gray-700 mt-4">Product Not Found</h2>
          <p className="text-gray-600 mt-2">The product you're looking for doesn't exist or has been removed.</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-6 px-4 py-2 bg-[#656d4a] hover:bg-[#414833] text-white rounded-lg transition-colors"
          >
            Return to Shop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb Navigation */}
      <br/><br/>
      <div className="flex items-center text-base text-gray-800 mb-6 mt-6">
        <button 
          onClick={() => navigate('/')} 
          className="hover:text-[#656d4a] font-semibold"
        >
          Home
        </button>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="md:flex">
          {/* Product Image */}
          <div className="md:w-1/2">
            <div className="relative h-80 md:h-full">
              <img 
                src={product.imageUrl} 
                alt={product.name} 
                className="h-full w-full object-cover object-center"
              />
            </div>
          </div>
          
          {/* Product Details */}
          <div className="p-6 md:p-8 md:w-1/2">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                <div className="flex items-center mt-1">
                  <span className="bg-[#e6e8e6] text-[#656d4a] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {product.category}
                  </span>
                </div>
              </div>
              
              {/* Share Button */}
              <button 
                onClick={openShareModal}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Share product"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 text-gray-600" 
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
            
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-3xl font-bold text-[#656d4a]">৳{product.price}</span>
                  <div className="text-sm text-gray-600 mt-1">
                    Delivery: ৳{product.deliveryCharge}
                  </div>
                </div>
                
                {/* Stock Status */}
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  product.inStock === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {product.inStock === false ? 'Out of Stock' : 'In Stock'}
                </div>
              </div>
              
              {/* Product Description */}
              <div className="prose prose-sm mt-4 text-gray-700">
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p>{product.description || "No description available for this product."}</p>
              </div>
              
              {/* Product Location */}
              {product.location && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Location</h3>
                  <div className="flex items-center text-gray-700">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-5 w-5 mr-2 text-gray-500" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
                      />
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
                      />
                    </svg>
                    <a 
                      href={product.location.startsWith('http') 
                        ? product.location 
                        : `https://www.google.com/maps/search/${encodeURIComponent(product.location)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="break-words text-blue-600 hover:underline"
                    >
                      {product.location}
                    </a>
                  </div>
                </div>
              )}
              
              {/* Quantity Selector */}
              <div className="mt-6">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <div className="flex items-center">
                  <button 
                    onClick={decrementQuantity}
                    className="w-10 h-10 border border-gray-300 rounded-l-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200"
                    disabled={quantity <= 1}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    className="w-16 h-10 border-t border-b border-gray-300 text-center focus:outline-none focus:ring-0 focus:border-gray-300"
                    value={quantity}
                    onChange={handleQuantityChange}
                    min="1"
                    max="10"
                  />

                  <button 
                    onClick={incrementQuantity}
                    className="w-10 h-10 border border-gray-300 rounded-r-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200"
                    disabled={quantity >= 10}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={product.inStock === false}
                className={`w-full mt-6 py-3 px-6 rounded-lg flex items-center justify-center ${
                  product.inStock === false ? 
                  'bg-gray-300 cursor-not-allowed' : 
                  'bg-[#22333b] hover:bg-[#1a282e] text-white'
                }`}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5 mr-2" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" 
                  />
                </svg>
                {product.inStock === false ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
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
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-16 h-16 object-cover rounded"
                />
                <div>
                  <h4 className="font-medium">{product.name}</h4>
                  <p className="text-sm text-gray-600">{product.category}</p>
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

export default Product;