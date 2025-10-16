import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, limit, orderBy,getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function OrderList() {
  const [orders, setOrders] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);
  const { currentUser } = useAuth();
  const [systemSettings, setSystemSettings] = useState({ // Default 6 minutes
  });

  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Update current time every 5 seconds instead of every second to reduce updates
   // Fetch system settings
  // Update current time every 5 seconds instead of every second to reduce updates
   // Fetch system settings
   // Fetch system settings using real-time listener
   useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'systemSettings', 'cancellationTimes'));
        if (settingsDoc.exists()) {
          setSystemSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error('Error fetching system settings:', error);
      }
    };
    
    fetchSystemSettings();
  }, []);

  useEffect(() => {

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000);
    
    return () => clearInterval(timer);
  }, []);

  // Fixed data loading
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    
    // Let's fix the query to ensure compatibility with the original code
    // Removed the orderBy since it might be causing issues with the where clause
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid)
    );

    try {
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setOrders(ordersData);
        setLoading(false);
      }, error => {
        console.error("Error fetching orders:", error);
        toast.error("Failed to load orders");
        setLoading(false);
      });
  
      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up orders listener:", error);
      toast.error("Failed to connect to database");
      setLoading(false);
    }
  }, [currentUser]);

  const confirmDelivery = useCallback(async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        customerConfirmed: true
      });
      toast.success('Delivery confirmed');
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error('Failed to confirm delivery');
    }
  }, []);

  const cancelOrder = useCallback(async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'pending',
        deliveryPersonId: null,
        deliveryStartTime: null,
        cancelledByCustomer: true
      });
      toast.success('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  }, []);

  const deleteOrder = useCallback(async (orderId) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  }, []);

  // Calculate time remaining for cancellation (in seconds)
 const getTimeRemainingForCancel = (order) => {
  if (!order.deliveryStartTime) return 0;
  
  // Handle both server timestamp and client timestamp
  const startTime = order.deliveryStartTime.toDate ? 
                    order.deliveryStartTime.toDate() : 
                    new Date(order.deliveryStartTime);
                    
  const timePassedMs = currentTime.getTime() - startTime.getTime();
  const timePassedSec = Math.floor(timePassedMs / 1000);
  const cancelWindowSec = systemSettings.customerCancellationTime * 60; // Convert minutes to seconds
  
  return Math.max(0, cancelWindowSec - timePassedSec);
};

  // Format remaining time as MM:SS - memoized to avoid re-renders
  const formatTimeRemaining = useCallback((timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Check if order is still cancellable - memoized
  const isOrderCancellable = useCallback((order) => {
    return order.status === 'in_progress' && getTimeRemainingForCancel(order) > 0;
  }, [getTimeRemainingForCancel]);

  // Check if order can be deleted - memoized
  const isOrderDeletable = useCallback((order) => {
    return order.status === 'pending' && !order.deliveryPersonId;
  }, []);

  // Format date helper function
  const formatDate = useCallback((timestamp) => {
    try {
      if (!timestamp) return 'N/A';
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString();
      }
      return new Date(timestamp).toLocaleString(); // fallback
    } catch {
      return 'Invalid Date';
    }
  }, []);

  // Get date for filtering purposes
  const getOrderDate = useCallback((timestamp) => {
    try {
      if (!timestamp) return null;
      let date;
      if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      return date;
    } catch {
      return null;
    }
  }, []);

  // Filter orders based on search criteria
  const filteredOrders = useMemo(() => {
    if (!orders.length) return [];
    
    return orders.filter(order => {
      // Text search
      const searchLower = searchTerm.toLowerCase().trim();
      
      // Handle empty search term
      if (!searchLower) {
        // Only apply date filter if search term is empty
        if (dateFilter === 'all') return true;
        
        const orderDate = getOrderDate(order.createdAt);
        if (!orderDate) return false;
        
        const today = new Date();
        const orderDay = orderDate.getDate();
        const orderMonth = orderDate.getMonth();
        const orderYear = orderDate.getFullYear();
        
        const todayDay = today.getDate();
        const todayMonth = today.getMonth();
        const todayYear = today.getFullYear();
        
        // Filter by date
        if (dateFilter === 'today') {
          return orderDay === todayDay && orderMonth === todayMonth && orderYear === todayYear;
        } else if (dateFilter === 'week') {
          // Get date from 7 days ago
          const weekAgo = new Date();
          weekAgo.setDate(today.getDate() - 7);
          return orderDate >= weekAgo;
        } else if (dateFilter === 'month') {
          return orderMonth === todayMonth && orderYear === todayYear;
        }
        
        return true;
      }
      
      // Text search in specific fields
      if (searchBy === 'id' || searchBy === 'all') {
        if (order.id.toLowerCase().includes(searchLower)) return true;
      }
      
      if (searchBy === 'status' || searchBy === 'all') {
        if (order.status.toLowerCase().includes(searchLower)) return true;
      }
      
      if (searchBy === 'items' || searchBy === 'all') {
        if (order.items && order.items.some(item => 
          item.name.toLowerCase().includes(searchLower)
        )) {
          return true;
        }
      }
      
      return false;
    });
  }, [orders, searchTerm, searchBy, dateFilter, getOrderDate]);

  // Sort orders - memoized to prevent unnecessary re-calculations
  const sortedOrders = useMemo(() => {
    if (!filteredOrders.length) return [];
    
    return [...filteredOrders].sort((a, b) => {
      // First priority: in_progress orders come first
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
      
      // Second priority: delivered orders come next
      if (a.status === 'delivered' && b.status !== 'delivered' && b.status !== 'in_progress') return -1;
      if (a.status !== 'delivered' && a.status !== 'in_progress' && b.status === 'delivered') return 1;
      
      // Third priority: Sort by creation date (newest first)
      const aTimestamp = a.createdAt?.seconds || 0;
      const bTimestamp = b.createdAt?.seconds || 0;
      return bTimestamp - aTimestamp;
    });
  }, [filteredOrders]);

  // Get displayed orders based on current visible count
  const displayedOrders = useMemo(() => {
    return sortedOrders.slice(0, visibleCount);
  }, [sortedOrders, visibleCount]);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => prev + 5);
  }, []);

  // Reset search and filters
  const resetSearch = useCallback(() => {
    setSearchTerm('');
    setSearchBy('all');
    setDateFilter('all');
    setVisibleCount(5);
  }, []);

  if (loading && orders.length === 0) {
    return <div className="text-center py-8">Loading your orders...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Your Orders</h2>
      
      {/* Search and filter section */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-grow">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search your orders..."
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
              />
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 absolute left-3 top-3 text-gray-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div>
            <select 
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All fields</option>
              <option value="id">Order ID</option>
              <option value="status">Status</option>
              <option value="items">Items</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
          
          <div className="text-sm">
            <button 
              onClick={resetSearch}
              className="text-blue-500 hover:text-blue-700 underline"
            >
              Reset filters
            </button>
            
            <span className="ml-4 text-gray-500">
              {sortedOrders.length} {sortedOrders.length === 1 ? 'order' : 'orders'} found
            </span>
          </div>
        </div>
      </div>
      
      {/* Order list section */}
      {sortedOrders.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 mt-4">No orders found</p>
          {searchTerm || dateFilter !== 'all' ? (
            <button
              onClick={resetSearch}
              className="mt-2 text-blue-500 hover:text-blue-700 underline"
            >
              Clear search filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {displayedOrders.map((order) => {
            const timeRemaining = getTimeRemainingForCancel(order);
            const canCancel = isOrderCancellable(order);
            const canDelete = isOrderDeletable(order);
            
            return (
              <div key={order.id} className={`card p-4 border rounded-lg shadow-sm ${
                order.status === 'in_progress' ? 'border-blue-500 bg-blue-50' : 
                order.status === 'delivered' ? 'border-green-500 bg-green-50' : ''
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">
                      Order ID: {order.id}
                    </p>
                    <p className="text-sm text-black">
                      delivery person email: {order.deliveryPersonMail}
                    </p>
                    
                    <p className="text-sm">
                      Date: {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">৳{order.total?.toFixed(2) || '0.00'}</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                
                {/* Show timer for in_progress orders */}
                {order.status === 'in_progress' && (
                  <div className="mt-2 bg-yellow-100 p-2 rounded-md flex justify-between items-center">
                    <p className="text-sm">
                      <span className="text-yellow-800">Someone picked up your order. If no one calls, you can cancel.</span><br/>
                      <span className="text-pink-700">
                        {timeRemaining > 0 ? 
                          `Cancel window: ${formatTimeRemaining(timeRemaining)}` : 
                          'Cancel window expired'}
                      </span>  
                    </p>
                    {canCancel && (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                )}
                
                {/* Show delete option for pending orders not picked up by a delivery person */}
                {canDelete && (
                  <div className="mt-2 bg-gray-100 p-2 rounded-md flex justify-between items-center">
                    <p className="text-sm text-gray-800">
                      This order hasn't been picked up yet
                    </p>
                    <button
                      onClick={() => deleteOrder(order.id)}
                      className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded"
                      >
                      Delete Order
                    </button>
                  </div>
                )}
                
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Items:</h3>
                  <ul className="space-y-2">
                    {(order.items || []).map((item, index) => (
                      <li key={index} className="flex justify-between text-sm">
                        <span>{item.name}</span>
                        <span>x{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {order.status === 'delivered' && !order.customerConfirmed && (
                  <button
                    onClick={() => confirmDelivery(order.id)}
                    className="btn btn-primary w-full mt-4"
                  >
                    Confirm Delivery Received
                  </button>
                )}
              </div>
            );
          })}
          
          {visibleCount < sortedOrders.length && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
              >
                Load More ({sortedOrders.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default OrderList;