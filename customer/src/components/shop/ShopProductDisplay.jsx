import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, limit, orderBy, startAfter } from 'firebase/firestore';
import { Store, ArrowRight, Tag, Package, ShoppingBag, TruckIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

function ShopProductDisplay({ 
  shopId, 
  limit: displayLimit = 6, 
  showVisitShop = true,
  onAddToCart 
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState(null);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [shopId, displayLimit]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let productsQuery;
      
      if (shopId) {
        // Fetch products for a specific shop
        productsQuery = query(
          collection(db, 'products'),
          where('shopId', '==', shopId),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc'),
          limit(displayLimit)
        );
      } else {
        // Fetch products from all approved shops
        productsQuery = query(
          collection(db, 'products'),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc'),
          limit(displayLimit)
        );
      }
      
      const productsSnapshot = await getDocs(productsQuery);
      
      if (productsSnapshot.empty) {
        setProducts([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      // Get the last document for pagination
      setLastVisible(productsSnapshot.docs[productsSnapshot.docs.length - 1]);
      
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(productsData);
      
      // If specified, fetch shop info
      if (shopId && productsData.length > 0) {
        // We can get shop info from any product
        const shopData = {
          id: shopId,
          name: productsData[0].shopName || 'Shop'
        };
        setShopInfo(shopData);
      }
      
      // Check if there are more products
      setHasMore(productsSnapshot.docs.length === displayLimit);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreProducts = async () => {
    if (!lastVisible) return;
    
    setLoading(true);
    try {
      let nextQuery;
      
      if (shopId) {
        nextQuery = query(
          collection(db, 'products'),
          where('shopId', '==', shopId),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(displayLimit)
        );
      } else {
        nextQuery = query(
          collection(db, 'products'),
          where('status', '==', 'approved'),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(displayLimit)
        );
      }
      
      const productsSnapshot = await getDocs(nextQuery);
      
      if (productsSnapshot.empty) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      // Update last visible
      setLastVisible(productsSnapshot.docs[productsSnapshot.docs.length - 1]);
      
      const newProductsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(prev => [...prev, ...newProductsData]);
      
      // Check if there are more products
      setHasMore(productsSnapshot.docs.length === displayLimit);
    } catch (error) {
      console.error('Error loading more products:', error);
      toast.error('Failed to load more products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    if (onAddToCart) {
      onAddToCart(product);
      toast.success(`${product.name} added to cart`);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#656d4a]"></div>
        <p className="mt-2 text-gray-500">Loading products...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Products Available</h3>
        <p className="text-gray-600">
          {shopId ? "This shop hasn't added any products yet." : "No products have been added yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {shopInfo && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Store className="h-6 w-6 text-[#656d4a] mr-2" />
            <h2 className="text-xl font-bold">{shopInfo.name}</h2>
          </div>
          
          {showVisitShop && (
            <Link 
              to={`/shop/${shopId}`}
              className="flex items-center text-[#656d4a] hover:text-[#414833]"
            >
              Visit Shop
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          )}
        </div>
      )}
      
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
                <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-1 rounded-full text-xs flex items-center">
                  <Tag className="h-3 w-3 mr-1" />
                  {product.category}
                </span>
              </div>
            </div>
            
            <div className="mt-4">
              <h3 className="text-lg font-semibold">{product.name}</h3>
              <p className="text-gray-600 text-sm">From: {product.shopName}</p>
              
              {product.description && (
                <p className="text-gray-600 mt-2 text-sm line-clamp-3">
                  {product.description}
                </p>
              )}
              
              <div className="flex justify-between items-center mt-3">
                <p className="font-bold text-[#656d4a]">৳{product.price.toFixed(2)}</p>
                <div className="text-sm text-[#656d4a]">
                  Delivery: ৳{product.deliveryCharge.toFixed(2)}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mt-3">
                {product.selfDelivery && (
                  <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-xs flex items-center">
                    <ShoppingBag className="h-3 w-3 mr-1" />
                    Shop delivery
                  </span>
                )}
                {product.platformDelivery && (
                  <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-xs flex items-center">
                    <TruckIcon className="h-3 w-3 mr-1" />
                    Platform delivery
                  </span>
                )}
              </div>
              
              {onAddToCart && (
                <button
                  onClick={() => handleAddToCart(product)}
                  className="btn btn-primary w-full mt-4"
                  style={{ backgroundColor: '#656d4a', color: 'white' }}
                >
                  Add to Cart
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {hasMore && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMoreProducts}
            disabled={loading}
            className="px-4 py-2 bg-[#d4a373] hover:bg-[#bc6c25] text-white rounded-lg flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading...
              </>
            ) : (
              <>
                Load More Products
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </button>
        </div>
      )}
      
      {showVisitShop && shopId && (
        <div className="flex justify-center mt-6">
          <Link 
            to={`/shop/${shopId}`}
            className="px-4 py-2 border border-[#656d4a] text-[#656d4a] hover:bg-[#e9edc9] rounded-lg flex items-center transition-colors"
          >
            Visit Shop
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default ShopProductDisplay;