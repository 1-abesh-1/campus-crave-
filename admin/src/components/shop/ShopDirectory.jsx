import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit, startAfter } from 'firebase/firestore';
import { Store, MapPin, ArrowRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function ShopDirectory() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const shopsQuery = query(
        collection(db, 'shops'),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc'),
        limit(8)
      );
      
      const shopsSnapshot = await getDocs(shopsQuery);
      
      if (shopsSnapshot.empty) {
        setShops([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      // Get the last document for pagination
      setLastVisible(shopsSnapshot.docs[shopsSnapshot.docs.length - 1]);
      
      const shopsData = shopsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setShops(shopsData);
      
      // Check if there are more shops
      setHasMore(shopsSnapshot.docs.length === 8);
    } catch (error) {
      console.error('Error fetching shops:', error);
      toast.error('Failed to load shops');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreShops = async () => {
    if (!lastVisible) return;
    
    setLoading(true);
    try {
      const nextQuery = query(
        collection(db, 'shops'),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(8)
      );
      
      const shopsSnapshot = await getDocs(nextQuery);
      
      if (shopsSnapshot.empty) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      // Update last visible
      setLastVisible(shopsSnapshot.docs[shopsSnapshot.docs.length - 1]);
      
      const newShopsData = shopsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setShops(prev => [...prev, ...newShopsData]);
      
      // Check if there are more shops
      setHasMore(shopsSnapshot.docs.length === 8);
    } catch (error) {
      console.error('Error loading more shops:', error);
      toast.error('Failed to load more shops');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredShops = shops.filter(shop => {
    const matchesName = shop.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDescription = shop.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAddress = shop.address?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesName || matchesDescription || matchesAddress;
  });

  if (loading && shops.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#656d4a]"></div>
        <p className="mt-2 text-gray-500">Loading shops...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Shop Directory</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search shops..."
            value={searchTerm}
            onChange={handleSearch}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#656d4a] focus:border-[#656d4a]"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>
      
      {filteredShops.length === 0 ? (
        <div className="text-center py-8">
          <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Shops Found</h3>
          <p className="text-gray-600">
            {searchTerm 
              ? "No shops match your search criteria. Try a different search term." 
              : "There are no shops available at the moment."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredShops.map(shop => (
            <Link 
              key={shop.id} 
              to={`/shop/${shop.id}`}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="h-32 rounded-lg overflow-hidden bg-[#f8f9fa] mb-4">
                {shop.bannerUrl ? (
                  <img
                    src={shop.bannerUrl}
                    alt={`${shop.name} banner`}
                    className="w-full h-full object-cover"
                  />
                ) :
                  <div className="w-full h-full flex items-center justify-center bg-[#e9edc9]">
                    <Store className="h-10 w-10 text-[#656d4a]" />
                  </div>
                }
              </div>
              
              <div className="flex items-start space-x-3 mb-2">
                <div className="h-12 w-12 flex-shrink-0 bg-[#f8f9fa] rounded-lg overflow-hidden">
                  {shop.logoUrl ? (
                    <img
                      src={shop.logoUrl}
                      alt={`${shop.name} logo`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#e9edc9]">
                      <Store className="h-6 w-6 text-[#656d4a]" />
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="font-semibold text-[#22333b] line-clamp-1">{shop.name}</h3>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    <span className="line-clamp-1">{shop.address}</span>
                  </p>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-grow">
                {shop.description}
              </p>
              
              <div className="mt-auto text-right">
                <span className="inline-flex items-center text-[#656d4a] hover:text-[#414833] text-sm font-medium">
                  Visit Shop
                  <ArrowRight className="h-4 w-4 ml-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      
      {hasMore && filteredShops.length > 0 && (
        <div className="flex justify-center mt-8">
          <button
            onClick={loadMoreShops}
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
                Load More Shops
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default ShopDirectory;