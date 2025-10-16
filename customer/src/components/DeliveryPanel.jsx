import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import DeliveryTracker from './DeliveryTracker';
import DeliveryEarnings from './Deliveryearnings';
import ShopManagement from './shop/ShopManagement';
import DeliveryAvailabilityToggle from './DeliveryAvailabilityToggle';
import DisclaimerTag from './DisclaimerTag';

function DeliveryPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { currentUser } = useAuth();
  const [systemSettings, setSystemSettings] = useState({
    deliveryPersonCancellationTime: 6, // Default 6 minutes
  });
  
  const [activeTab, setActiveTab] = useState('stat');
  const [showShopManagement, setShowShopManagement] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
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



// Check if the delivery person is approved
useEffect(() => {
  const checkApprovalStatus = async () => {
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setIsApproved(userSnap.data().isApproved === true);
        } else {
          setIsApproved(false);
        }
      } catch (error) {
        console.error('Error checking approval status:', error);
        setIsApproved(false);
      }
    }
  };
  
  checkApprovalStatus();
}, [currentUser]);




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
        where('status', '==', 'pending'),
        where('hasActiveDeliveryRequest', '!=', true)
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

  // Toggle between DeliveryPanel and ShopManagement
  const toggleView = () => {
    setShowShopManagement(!showShopManagement);
  };

const renderOrders=()=>{
  return  <DeliveryTracker />
}


const renderStat=()=>{
  return   <DeliveryEarnings />
}





  const renderActive=()=>{
    return (<div className="space-y-4">
    <h2 className="text-xl font-bold">Active Orders</h2>
    <DisclaimerTag panel={true}/><br/>
    
    <DeliveryAvailabilityToggle/>
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
          <div key={order.id} className={`card p-3 sm:p-4 border rounded-lg shadow-sm ${order.isMyOrder && order.status === 'in_progress' ? 'border-green-500 bg-green-50' : ''}`}>
            
            {/* Restructured layout with flex-col on small screens and flex-row on larger screens */}
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
              <div className="space-y-3 w-full">
                {order.isMyOrder && order.status === 'in_progress' && (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <div className="bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium inline-block">
                      Your Active Delivery
                    </div>
                    {/* Always show timer for active deliveries */}
                    <div className={`${timeRemaining > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'} px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium`}>
                      {timeRemaining > 0 ? 
                        `Cancel: ${formatTimeRemaining(timeRemaining)}` : 
                        'Cancel window expired'}
                    </div>
                  </div>
                )}
        
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-500">
                  <p>Order ID: {order.id}</p>
                  <p>
                  Date and time:{' '}
                  <p className="text-sm text-gray-500">
Date:{' '}
{order.createdAt
? order.createdAt.toDate
  ? order.createdAt.toDate().toLocaleString()
  : new Date(order.createdAt).toLocaleString()
: 'N/A'}
</p>


                  </p>
                  <p>
                    Status: <span className="font-medium">{order.status}</span>
                  </p>
                </div>
                
                {/* Customer Contact Information */}
               {order.isMyOrder?<div className="bg-blue-50 p-2 sm:p-3 rounded-md">
                  <h3 className="font-medium text-blue-800 text-sm mb-1 sm:mb-2">Customer Details:</h3>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">Contact:</span> {order.contactNumber || 'Not provided'}
                  </p>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">email:</span> {order.customerEmail || 'Not provided'}
                  </p>
                  <b>total food's price: </b>৳{order.subtotal}<br/>
               <b>delivery cahrge: </b><span className='text-blue-600'>৳{order.deliveryCharge}</span><br/>
                  <div className="mt-1">
                    <span className="font-semibold text-xs sm:text-sm">Delivery Address:</span> 
                    <p className="text-xs sm:text-sm mt-1 whitespace-pre-line">
                      {order.deliveryLocation || order.location || 'Not provided'}
                    </p>
                  </div>
                </div>:<div className="bg-yellow-50 p-2 sm:p-3 rounded-md"> start delivery to see customer details
                <div className="mt-1">
                <b>total food's price: </b>৳{order.subtotal}<br/>
               <b>delivery cahrge: </b><span className='text-blue-600'>৳{order.deliveryCharge}</span><br/>
                    <span className="font-semibold text-xs sm:text-sm">Delivery Address:</span> 
                   
                    <p className="text-xs sm:text-sm mt-1 whitespace-pre-line">
                      {order.deliveryLocation || order.location || 'Not provided'}
                    </p>
                  </div>
                  </div>}
                
                <div className="mt-3 sm:mt-4">
                  <h3 className="font-medium text-sm sm:text-base mb-1 sm:mb-2">Items:</h3>
                  <ul className="space-y-2">
                    {(order.items || []).map((item, index) => (
                      <li key={index} className="text-xs sm:text-sm">
                        <h5 className="text-green-700">{item.name} x{item.quantity}</h5> 
                        <p className="text-gray-600">{item.description}</p>
                        {/* Display each item's location if available */}
                        {item.location && (
                          <div className="mt-1 ml-2 sm:ml-4 text-xs">
                            <a 
                              href={item.location} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 break-words"
                            >
                              {item.location}
                            </a>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  
                </div>
              </div>
        
              {/* Action buttons - full width on mobile, appropriate width on desktop */}
              <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-[140px]">
                {order.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'in_progress')}
                    className="btn btn-secondary w-full text-sm"
                  >
                    Start Delivery
                  </button>
                )}
                {order.status === 'in_progress' && order.isMyOrder && (
                  <>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      className="btn btn-primary w-full text-sm"
                    >
                      confirm pickup
                    </button>
                    {/* Only show cancel button if within time window */}
                    {canCancel && (
                      <button
                        onClick={() => cancelDelivery(order.id)}
                        className="btn bg-red-500 hover:bg-red-600 text-white w-full text-sm"
                      >
                        Cancel pickup
                      </button>
                    )}
                  </>
                )}
                {order.status === 'delivered' && order.isMyOrder && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                    className={`w-full px-4 py-2 rounded font-medium transition ${
                      order.customerConfirmed
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`} disabled={!order.customerConfirmed}
                  >
                    Confirm payment
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })
    )}
  </div>)
  }



  return (
    <div className="space-y-8">
      {/* Toggle Button */}
      {/* Registration Status Message */}
{isApproved ? (
  <div className="mb-4 p-3 bg-green-100 border border-green-200 rounded-lg text-green-800">
    <p className="flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      You are registered as an approved delivery person.
    </p>
  </div>
) : (
  <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-lg text-yellow-800">
    <p className="mb-2">
      <strong>Note:</strong> You are not registered.(Not mandatory)
    </p>
    <p className="mb-2">
      To register, please complete the registration form at:
    </p>
    <a 
      href="https://forms.gle/Qv2gzC5pHnLwt2bp9" 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      https://forms.gle/Qv2gzC5pHnLwt2bp9
    </a>
    <p className="mt-2 text-sm">
      Registered delivery persons will get administration tasks later.
    </p>
  </div>
)}


      <div className="flex justify-end mb-4">
        <button 
          onClick={toggleView}
          className="btn bg-[#9db677]"
        >
          {showShopManagement ? 'Switch to Delivery Panel' : 'Switch to Shop Management'}
        </button>
      </div>

      {showShopManagement ? (
        <ShopManagement />
      ) : (
        <>
  <nav className="flex space-x-8">
  <button
            onClick={() => setActiveTab('stat')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stat'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            earnings
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'active'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
          active orders
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'orders'
                ? 'border-[#656d4a] text-[#656d4a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            history
          </button>
    
        </nav>
          {activeTab === 'active' && renderActive()}
              {activeTab === 'stat' && renderStat()}
              {activeTab === 'orders' && renderOrders()}
        </>
      )}


    </div>
  );
}

export default DeliveryPanel;