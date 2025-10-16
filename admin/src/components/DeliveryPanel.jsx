import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import DeliveryTracker from './DeliveryTracker';
import DeliveryEarnings from './Deliveryearnings';

function DeliveryPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { currentUser } = useAuth();
  const [systemSettings, setSystemSettings] = useState({
    deliveryPersonCancellationTime: 6, // Default 6 minutes
  });



    // Fetch system settings
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
  // Update current time every second to track cancellation timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchOrders();
    
    // Set up real-time listener for orders to get updates
    const myOrdersQuery = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'in_progress', 'delivered'])
    );
    
    const unsubscribe = onSnapshot(myOrdersQuery, (snapshot) => {
      fetchOrders(); // Refresh orders when database changes
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  const fetchOrders = async () => {
    try {
      // Query for orders assigned to this delivery person
      const myOrdersQuery = query(
        collection(db, 'orders'),
        where('status', 'in', ['in_progress', 'delivered']),
        where('deliveryPersonId', '==', currentUser.uid)
      );
      
      // Query for available orders
      const availableOrdersQuery = query(
        collection(db, 'orders'),
        where('status', '==', 'pending')
      );
      
      const [myOrdersSnapshot, availableOrdersSnapshot] = await Promise.all([
        getDocs(myOrdersQuery),
        getDocs(availableOrdersQuery)
      ]);
      
      const myOrders = myOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isMyOrder: true
      }));
      
      const availableOrders = availableOrdersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isMyOrder: false
      }));
      
      // Combine both sets of orders
      setOrders([...myOrders, ...availableOrders]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
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
        updates.deliveryPersonMail = currentUser.email;
        
        updates.deliveryStartTime = serverTimestamp();
      }
      
      await updateDoc(orderRef, updates);
      toast.success(`Order marked as ${newStatus}`);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  const cancelDelivery = async (orderId) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'pending',
        deliveryPersonId: null,
        deliveryStartTime: null
      });
      toast.success('Delivery canceled successfully');
      fetchOrders();
    } catch (error) {
      console.error('Error canceling delivery:', error);
      toast.error('Failed to cancel delivery');
    }
  };
 // Calculate time remaining for cancellation (in seconds)
 const getTimeRemainingForCancel = (order) => {
  if (!order.deliveryStartTime) return 0;
  
  // Handle both server timestamp and client timestamp
  const startTime = order.deliveryStartTime.toDate ? 
                    order.deliveryStartTime.toDate() : 
                    new Date(order.deliveryStartTime);
                    
  const timePassedMs = currentTime.getTime() - startTime.getTime();
  const timePassedSec = Math.floor(timePassedMs / 1000);
  const cancelWindowSec = systemSettings.deliveryPersonCancellationTime * 60; // Convert minutes to seconds
  
  return Math.max(0, cancelWindowSec - timePassedSec);
};

// Format remaining time as MM:SS
const formatTimeRemaining = (timeInSeconds) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

  // Check if delivery is still cancellable
  const isDeliveryCancellable = (order) => {
    return order.status === 'in_progress' && getTimeRemainingForCancel(order) > 0;
  };

  const filteredOrders = orders.filter(order => {
    const customerAddressLower = (order.deliveryLocation || order.location || '').toLowerCase();
    const orderId = order.id.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    // Check if items contain the search term
    const itemsMatch = (order.items || []).some(item => 
      (item.name || '').toLowerCase().includes(searchLower)
    );
    
    return orderId.includes(searchLower) || 
           customerAddressLower.includes(searchLower) ||
           itemsMatch;
  });

  // Sort orders: my in-progress orders first, then my delivered orders, then available orders
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    // First priority: My orders come before available orders
    if (a.isMyOrder && !b.isMyOrder) return -1;
    if (!a.isMyOrder && b.isMyOrder) return 1;
    
    // Second priority: Among my orders, in_progress comes before delivered
    if (a.isMyOrder && b.isMyOrder) {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    }
    
    // Third priority: Sort by creation date (newest first)
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });

  if (loading) {
    return <div>Loading orders...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Delivery Earnings Section */}
      <DeliveryEarnings />
      <DeliveryTracker />
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Active Orders</h2>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search orders by ID, address or items..."
            className="input w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {sortedOrders.length === 0 ? (
          <p className="text-gray-500">No orders found</p>
        ) : (
          sortedOrders.map((order) => {
            const timeRemaining = getTimeRemainingForCancel(order);
            const canCancel = isDeliveryCancellable(order);
            
            return (
              <div key={order.id} className={`card p-4 border rounded-lg shadow-sm ${order.isMyOrder && order.status === 'in_progress' ? 'border-green-500 bg-green-50' : ''}`}>
                        
                <div className="flex justify-between items-start">
                  <div className="space-y-3">
                    {order.isMyOrder && order.status === 'in_progress' && (
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium inline-block">
                          Your Active Delivery
                        </div>
                        {/* Always show timer for active deliveries */}
                        <div className={`${timeRemaining > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'} px-3 py-1 rounded-full text-sm font-medium`}>
                          {timeRemaining > 0 ? 
                            `Cancel window: ${formatTimeRemaining(timeRemaining)}` : 
                            'Cancel window expired'}
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-500">Order ID: {order.id}</p>
                    <p className="text-sm text-gray-500">
                      Date: {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Status: <span className="font-medium">{order.status}</span>
                    </p>
                    
                    {/* Customer Contact Information */}
                    <div className="bg-blue-50 p-3 rounded-md">
                      <h3 className="font-medium text-blue-800 mb-2">Customer Details:</h3>
                      <p className="text-sm">
                        <span className="font-semibold">Contact:</span> {order.contactNumber || 'Not provided'}
                      </p>
                      <p className="text-sm">
                        <span className="font-semibold">email:</span> {order.customerEmail || 'Not provided'}
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
                           <h5 className="text-green-700">{item.name} x{item.quantity}</h5> 
                            {item.description}
                            {/* Display each item's location if available */}
                            {item.location && (
                              <div className="mt-1 ml-4 text-xs">
                                <a 
                                  href={item.location} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {item.location}
                                </a>
                              </div>
                            )}
                          </li>
                        ))}
                     
                      </ul>
                      total food's price: ৳{order.subTotal}
                      delivery cahrge: ৳{order.deliveryCharge}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'in_progress')}
                        className="btn btn-secondary w-full"
                      >
                        Start Delivery
                      </button>
                    )}
                    {order.status === 'in_progress' && order.isMyOrder && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                          className="btn btn-primary w-full"
                        >
                          Mark as Delivered
                        </button>
                        {/* Only show cancel button if within time window */}
                        {canCancel && (
                          <button
                            onClick={() => cancelDelivery(order.id)}
                            className="btn bg-red-500 hover:bg-red-600 text-white w-full mt-2"
                          >
                            Cancel Delivery
                          </button>
                        )}
                      </>
                    )}
                    {order.status === 'delivered' && order.isMyOrder && (<>
                     after delivery tell your customer to confirm after that delivery from here.
                      <button
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="btn btn-green w-full"
                        disabled={!order.customerConfirmed}
                      >
                      Confirm payment received
                      </button>
                   </> )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default DeliveryPanel;