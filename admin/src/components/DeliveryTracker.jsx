import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function DeliveryTracker({ isAdmin = false }) {
  const [deliveries, setDeliveries] = useState([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState([]);
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);
  const [visibleStart, setVisibleStart] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 5);
    setVisibleStart((prev) => prev + 5);
  };

  const handleLoadLess = () => {
    setVisibleCount((prev) => prev - 5);
    setVisibleStart((prev) => prev - 5);
  };

  // Track screen width for responsive date formatting
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [currentUser, isAdmin]);

  useEffect(() => {
    // Filter deliveries based on search term
    if (searchTerm.trim() === '') {
      setFilteredDeliveries(deliveries);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const filtered = deliveries.filter(delivery => 
        delivery.id.toLowerCase().includes(lowercasedSearch) ||
        delivery.status.toLowerCase().includes(lowercasedSearch) ||
        (delivery.deliveryPersonMail && delivery.deliveryPersonMail.toLowerCase().includes(lowercasedSearch)) ||
        (delivery.userId && delivery.userId.toLowerCase().includes(lowercasedSearch)) ||
        formatDate(delivery.createdAt, screenWidth).toLowerCase().includes(lowercasedSearch)
      );
      setFilteredDeliveries(filtered);
    }
    // Reset pagination when search changes
    setVisibleStart(0);
  }, [searchTerm, deliveries, screenWidth]);

  const fetchDeliveries = async () => {
    try {
      let q;
      
      // If admin, fetch all orders, otherwise only fetch user's deliveries
      if (isAdmin) {
        q = query(collection(db, 'orders'));
      } else {
        q = query(
          collection(db, 'orders'),
          where('deliveryPersonId', '==', currentUser.uid)
        );
      }
      
      const snapshot = await getDocs(q);
      const deliveriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDeliveries(deliveriesData);
      setFilteredDeliveries(deliveriesData);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const deleteDelivery = async (deliveryId) => {
    try {
      await deleteDoc(doc(db, 'orders', deliveryId));
      // Update the local state to reflect the deletion
      setDeliveries(prev => prev.filter(delivery => delivery.id !== deliveryId));
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting delivery:', error);
      toast.error('Failed to delete order');
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Format date based on screen size
  const formatDate = (dateValue, width) => {
    if (!dateValue) return 'N/A';
    
    try {
      // Convert various date formats to JavaScript Date object
      let dateObj;
      
      if (typeof dateValue.toDate === 'function') {
        dateObj = dateValue.toDate();
      } else if (dateValue.seconds) {
        dateObj = new Date(dateValue.seconds * 1000);
      } else {
        dateObj = new Date(dateValue);
      }
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      // Different format options based on screen width
      if (width <= 480) {
        // Mobile view (smallest screens)
        return dateObj.toLocaleDateString(undefined, {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } else if (width <= 768) {
        // Tablet view
        return dateObj.toLocaleDateString(undefined, {
          year: '2-digit',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } else {
        // Desktop view (full date)
        return dateObj.toLocaleDateString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  if (loading) {
    return <div>Loading deliveries...</div>;
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">
        {isAdmin ? "All Orders (Admin Mode)" : "Your Deliveries"}
      </h2>
      
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder={isAdmin ? "Search all orders..." : "Search deliveries..."}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {searchTerm && (
            <button
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              onClick={() => setSearchTerm('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {filteredDeliveries.length === 0 ? (
        <p className="text-center py-4 text-gray-500">
          {isAdmin ? "No orders found" : "No matching deliveries found"}
        </p>
      ) : (
        <>
          {filteredDeliveries.slice(visibleStart, visibleStart + visibleCount).map((delivery) => (
            <div key={delivery.id} className="border rounded p-4 mb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start">
                <div className="mb-2 sm:mb-0">
                  <p className="font-medium">Order #{delivery.id.slice(0, 8)}</p>
                  
                  <p className="text-sm text-gray-500">
                    Status: {delivery.status}
                  </p>
                  
                  {delivery.deliveryPersonMail && (
                    <p className="text-sm text-gray-500">
                      Delivered by: {delivery.deliveryPersonMail}
                    </p>
                  )}
                  
                  {/* Show customer info for admin */}
                  {isAdmin && delivery.userId && (
                    <p className="text-sm text-gray-500">
                      Customer ID: {delivery.userId.slice(0, 8)}
                    </p>
                  )}
                  
                  {delivery.deliveryCharge && (
                    <p className="text-sm text-gray-500">
                      {isAdmin 
                        ? `Delivery Charge:  ৳${delivery.deliveryCharge.toFixed(2)}`
                        : `Earnings: ৳${(delivery.deliveryCharge * 0.8).toFixed(2)}`
                      }
                    </p>
                  )}
                  
                  {delivery.total && (
                    <p className="text-sm text-gray-500">
                      Total: ৳{delivery.total.toFixed(2)}
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-500 break-words">
  Date: {(() => {
    try {
      if (!delivery.createdAt) return 'N/A';
      if (typeof delivery.createdAt.toDate === 'function') {
        return delivery.createdAt.toDate().toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      if (delivery.createdAt.seconds) {
        return new Date(delivery.createdAt.seconds * 1000).toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
      return new Date(delivery.createdAt).toLocaleString('en-GB', {
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
                
              </div>
              
              {/* Show items for admin view */}
              {isAdmin && delivery.items && delivery.items.length > 0 && (
                <div className="mt-3">
                  <b> contact: {delivery.contactNumber}</b><br/>
                  <b>customer email: {delivery.customerEmail}</b>
                  <h3 className="text-sm font-medium">Items:</h3>
                  <ul className="text-sm text-gray-600">
                    {delivery.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{item.name}</span>
                        <span>x{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Admin delete button */}
              {isAdmin && (
                <div className="mt-3 text-right">
                  <button
                    onClick={() => deleteDelivery(delivery.id)}
                    className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
                  >
                    Delete Order
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-center pt-4">
            {visibleStart !== 0 && (
              <button
                onClick={handleLoadLess}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                {"<-Back"}
              </button>
            )}
            <span className="px-4 py-2 text-gray-600">
              {visibleStart + 1}-{Math.min(visibleStart + visibleCount, filteredDeliveries.length)} of {filteredDeliveries.length}
            </span>
            {visibleStart + visibleCount < filteredDeliveries.length && (
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                {"Next->"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DeliveryTracker;