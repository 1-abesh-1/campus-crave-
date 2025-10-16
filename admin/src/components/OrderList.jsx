import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function OrderList() {
  const [orders, setOrders] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { currentUser } = useAuth();

  // Update current time every second to track timers
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const confirmDelivery = async (orderId) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        customerConfirmed: true
      });
      toast.success('Delivery confirmed');
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error('Failed to confirm delivery');
    }
  };

  const cancelOrder = async (orderId) => {
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
  };

  const deleteOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
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
    const cancelWindowSec = 10 * 60; // 10 minutes in seconds
    
    return Math.max(0, cancelWindowSec - timePassedSec);
  };

  // Format remaining time as MM:SS
  const formatTimeRemaining = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Check if order is still cancellable
  const isOrderCancellable = (order) => {
    return order.status === 'in_progress' && getTimeRemainingForCancel(order) > 0;
  };

  // Check if order can be deleted (pending and not picked up by a delivery person)
  const isOrderDeletable = (order) => {
    return order.status === 'pending' && !order.deliveryPersonId;
  };

  // Sort orders by status (in-progress first) and then by date (newest first)
  const sortedOrders = [...orders].sort((a, b) => {
    // First priority: in_progress orders come first
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    
    // Second priority: delivered orders come next
    if (a.status === 'delivered' && b.status !== 'delivered' && b.status !== 'in_progress') return -1;
    if (a.status !== 'delivered' && a.status !== 'in_progress' && b.status === 'delivered') return 1;
    
    // Third priority: Sort by creation date (newest first)
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Your Orders</h2>
      {sortedOrders.length === 0 ? (
        <p className="text-gray-500">No orders found</p>
      ) : (
        sortedOrders.map((order) => {
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
                  
                  <p className="text-sm">
                    Date: {(() => {
                      try {
                        if (!order.createdAt) return 'N/A';
                        if (typeof order.createdAt.toDate === 'function') {
                          return order.createdAt.toDate().toLocaleString();
                        }
                        if (order.createdAt.seconds) {
                          return new Date(order.createdAt.seconds * 1000).toLocaleString();
                        }
                        return new Date(order.createdAt).toLocaleString(); // fallback
                      } catch {
                        return 'Invalid Date';
                      }
                    })()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${order.total?.toFixed(2) || '0.00'}</p>
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
                  <p className="text-sm ">
                 <span className="text-yellow-800">someone picked. If no one calls you regarding the delivery you can cancel.</span> <br/>
                  <span className="text-pink-700">{timeRemaining > 0 ? 
                      `Cancel window: ${formatTimeRemaining(timeRemaining)}` : 
                      'Cancel window expired'}</span>  
                  </p>
                  {/* Only show the cancel button within time window */}
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
        })
      )}
    </div>
  );
}

export default OrderList;