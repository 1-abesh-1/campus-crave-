import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function DeliveryAvailabilityToggle() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [deliveryRequests, setDeliveryRequests] = useState([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Fetch the current availability status when component mounts
    const fetchAvailabilityStatus = async () => {
      if (!currentUser) return;
      
      try {
        const deliveryPersonRef = doc(db, 'deliveryPersons', currentUser.uid);
        const docSnap = await getDoc(deliveryPersonRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsAvailable(data.isAvailable || false);
          setLocation(data.location || '');
        }
      } catch (error) {
        console.error('Error fetching availability status:', error);
        toast.error('Failed to load your availability status');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAvailabilityStatus();
  }, [currentUser]);

  // Fetch delivery requests
  useEffect(() => {
    if (!currentUser) return;
    
    try {
      // Set up listener for delivery requests for this delivery person
      const requestsQuery = query(
        collection(db, 'deliveryRequests'),
        where('deliveryPersonId', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      
      const unsubscribe = onSnapshot(requestsQuery, async (snapshot) => {
        // Get the basic request data
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Enhance with order details by fetching each order
        const enhancedRequests = await Promise.all(
          requestsData.map(async (request) => {
            try {
              const orderRef = doc(db, 'orders', request.orderId);
              const orderSnap = await getDoc(orderRef);
              
              if (orderSnap.exists()) {
                const orderData = orderSnap.data();
                return {
                  ...request,
                  orderDetails: {
                    location: orderData.deliveryLocation || orderData.location || 'Unknown',
                    total: orderData.total || 0,
                    items: orderData.items || [],
                    customer: orderData.customerEmail || orderData.customer || 'Unknown'
                  }
                };
              }
              return request;
            } catch (err) {
              console.error('Error fetching order details:', err);
              return request;
            }
          })
        );
        
        setDeliveryRequests(enhancedRequests);
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up requests listener:', error);
    }
  }, [currentUser]);

  const toggleAvailability = async () => {
    if (!currentUser) return;
    
    // If toggling to available but no location is set, show error
    if (!isAvailable && !location.trim()) {
      toast.error('Please set your location before marking yourself as available');
      return;
    }
    
    try {
      setLoading(true);
      const deliveryPersonRef = doc(db, 'deliveryPersons', currentUser.uid);
      const docSnap = await getDoc(deliveryPersonRef);
      
      const newStatus = !isAvailable;
      const updatedData = {
        isAvailable: newStatus,
        location: location,
        email: currentUser.email,
        lastUpdated: new Date().toISOString()
      };
      
      if (docSnap.exists()) {
        // Update existing document
        await updateDoc(deliveryPersonRef, updatedData);
      } else {
        // Create new document
        await setDoc(deliveryPersonRef, updatedData);
      }
      
      setIsAvailable(newStatus);
      toast.success(`You are now ${newStatus ? 'available' : 'unavailable'} for deliveries`);
    } catch (error) {
      console.error('Error updating availability status:', error);
      toast.error('Failed to update your availability status');
    } finally {
      setLoading(false);
    }
  };

  const updateLocation = async () => {
    if (!currentUser || !location.trim()) return;
    
    try {
      setLoading(true);
      const deliveryPersonRef = doc(db, 'deliveryPersons', currentUser.uid);
      const docSnap = await getDoc(deliveryPersonRef);
      
      if (docSnap.exists()) {
        // Update existing document
        await updateDoc(deliveryPersonRef, {
          location: location,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Create new document
        await setDoc(deliveryPersonRef, {
          isAvailable: false,
          location: location,
          email: currentUser.email,
          lastUpdated: new Date().toISOString()
        });
      }
      
      toast.success('Your location has been updated');
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('Failed to update your location');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAction = async (requestId, orderId, action) => {
    try {
      setLoading(true);
      const requestRef = doc(db, 'deliveryRequests', requestId);
      
      if (action === 'accept') {
        // Update the delivery request status
        await updateDoc(requestRef, {
          status: 'accepted',
          respondedAt: new Date().toISOString()
        });
        
        // Update the order status and assign to this delivery person
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
          status: 'in_progress',
          deliveryPersonId: currentUser.uid,
          deliveryPersonMail: currentUser.email,
          deliveryStartTime: new Date().toISOString(),
          isMyOrder: true,
          hasActiveDeliveryRequest: false
        });

         
        toast.success('You have accepted the delivery request');
      } else if (action === 'reject') {
        // Just update the request status
        await updateDoc(requestRef, {
          status: 'rejected',
          respondedAt: new Date().toISOString()
        });
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
        
          hasActiveDeliveryRequest: false
        });
        
        toast.success('You have declined the delivery request');
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast.error(`Failed to ${action} the delivery request`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading availability status...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Delivery Availability</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Status:</span>
          <div className="flex items-center">
            <span className={`inline-flex mr-3 items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isAvailable ? 'Available' : 'Unavailable'}
            </span>
            <button
              onClick={toggleAvailability}
              disabled={loading}
              className={`px-4 py-2 rounded-md text-white text-sm font-medium transition-colors ${
                isAvailable
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isAvailable ? 'Mark Unavailable' : 'Mark Available'}
            </button>
          </div>
        </div>
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded">
  <p>
    Marking yourself as available is not mandatory. It simply helps customers find you if you're near their order location.
  </p>
</div>


        <div className="mt-4">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Your Current Location
          </label>
          <div className="flex">
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter your current location"
              className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={updateLocation}
              disabled={loading || !location.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r-md font-medium transition-colors disabled:bg-blue-300"
            >
              Update
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Provide details like area, landmark, etc. to help customers find you
          </p>
        </div>
        
        {/* Delivery Requests Section */}
        <div className="mt-6">
          <h3 className="text-md font-semibold mb-3">Delivery Requests ({deliveryRequests.length})</h3>
          
          {deliveryRequests.length === 0 ? (
            <p className="text-gray-500 italic">No pending delivery requests</p>
          ) : (
            <div className="space-y-4">
              {deliveryRequests.map(request => (
                <div key={request.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Order #{request.orderId.substring(0, 8)}...</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Requested: {new Date(request.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending Request
                    </span>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <h5 className="text-xs font-medium text-gray-700">Delivery Location:</h5>
                      <p className="text-sm">{request.orderDetails?.location || request.orderLocation || 'Not specified'}</p>
                    </div>
                    <div>
                      <h5 className="text-xs font-medium text-gray-700">Order Total:</h5>
                      <p className="text-sm">৳{request.orderDetails?.total?.toFixed(2) || request.orderTotal?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <h5 className="text-xs font-medium text-gray-700">Order Items:</h5>
                    <p className="text-sm">{request.orderDetails?.items?.length || request.orderItems || 0} items</p>
                  </div>
                  
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => handleRequestAction(request.id, request.orderId, 'accept')}
                      disabled={loading}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors disabled:bg-green-300"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRequestAction(request.id, request.orderId, 'reject')}
                      disabled={loading}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded transition-colors disabled:bg-red-300"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeliveryAvailabilityToggle;