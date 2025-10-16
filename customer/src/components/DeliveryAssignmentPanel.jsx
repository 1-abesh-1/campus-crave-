import { useState, useEffect } from 'react';
import { collection, query, where, getDoc, updateDoc, doc, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function DeliveryAssignmentPanel({ 
  orderId = null, 
  orderLocation = '', 
  onAssign = null, 
  hasMultipleLocations = false,
  locationsList = [] // New prop to accept array of locations
}) {
  const [availableDeliveryPersons, setAvailableDeliveryPersons] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [locationMatchThreshold, setLocationMatchThreshold] = useState(0.3); // Default threshold
  
  // Parse locations if they're provided as a string instead of array
  const orderLocations = locationsList.length > 0 
    ? locationsList 
    : hasMultipleLocations && orderLocation.includes(',') 
      ? orderLocation.split(',').map(loc => loc.trim()).filter(loc => loc !== '')
      : orderLocation ? [orderLocation] : [];

  // Check if current user is an admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUser) return;
      
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setIsAdmin(userSnap.data().isAdmin === true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, [currentUser]);

  // Fetch available delivery persons and pending orders
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch available delivery persons
        const deliveryPersonsQuery = query(
          collection(db, 'deliveryPersons'),
          where('isAvailable', '==', true)
        );
        
        // Set up real-time listener for delivery persons
        const unsubscribeDeliveryPersons = onSnapshot(deliveryPersonsQuery, (snapshot) => {
          const deliveryPersonsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setAvailableDeliveryPersons(deliveryPersonsData);
        });
        
        // Only fetch pending orders if not in checkout/cart mode
        if (!orderId) {
          // Fetch pending orders
          const pendingOrdersQuery = query(
            collection(db, 'orders'),
            where('status', '==', 'pending')
          );
          
          // Set up real-time listener for pending orders
          const unsubscribePendingOrders = onSnapshot(pendingOrdersQuery, (snapshot) => {
            const pendingOrdersData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setPendingOrders(pendingOrdersData);
          });
          
          setLoading(false);
          return () => {
            unsubscribeDeliveryPersons();
            unsubscribePendingOrders();
          };
        } else {
          setLoading(false);
          return () => {
            unsubscribeDeliveryPersons();
          };
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [orderId]);

  // Improved location match score calculator
  const calculateLocationMatchScore = (location1, location2) => {
    if (!location1 || !location2) return 0;

    // Normalize locations to lowercase
    const loc1 = location1.toLowerCase();
    const loc2 = location2.toLowerCase();
    
    // Direct substring check (gives high score for contained strings)
    if (loc1.includes(loc2) || loc2.includes(loc1)) {
      // Give higher score if one is fully contained in the other
      // Example: "cafe" is fully contained in "cafe 6-th floor"
      const shorterLength = Math.min(loc1.length, loc2.length);
      const longerLength = Math.max(loc1.length, loc2.length);
      // This gives a bonus for shorter exact matches (like "cafe" in "cafe 6-th floor")
      return 0.7 + (0.3 * (shorterLength / longerLength));
    }

    // If no direct substring match, proceed with token-based matching
    const normalizeLocation = (loc) => {
      return Array.from(
        new Set(
          loc.toLowerCase()
            .replace(/[^\w\s,]/g, '') // Remove special chars except commas and spaces
            .split(/[,\s]+/)          // Split by comma and space
            .map(word => word.trim())
            .filter(word => word.length > 1) // Allow 2-letter words like "st" for street
        )
      );
    };

    const loc1Keywords = normalizeLocation(location1);
    const loc2Keywords = normalizeLocation(location2);

    if (loc1Keywords.length === 0 || loc2Keywords.length === 0) return 0;

    let matchCount = 0;
    const matchedLoc2 = new Set();

    loc1Keywords.forEach(kw1 => {
      if (loc2Keywords.includes(kw1)) {
        // Full word match gets full score
        matchCount += 1;
        matchedLoc2.add(kw1);
      } else {
        // Check for partial word matches
        for (const kw2 of loc2Keywords) {
          if (!matchedLoc2.has(kw2)) {
            if (kw1.includes(kw2) || kw2.includes(kw1)) {
              // Partial match - give more weight to longer matches
              const matchLength = Math.min(kw1.length, kw2.length);
              const maxLength = Math.max(kw1.length, kw2.length);
              matchCount += 0.5 * (matchLength / maxLength);
              matchedLoc2.add(kw2);
              break;
            }
          }
        }
      }
    });

    // Average by total unique keywords across both
    const totalUniqueKeywords = new Set([...loc1Keywords, ...loc2Keywords]).size;
    return Math.min(1, matchCount / Math.max(1, totalUniqueKeywords));
  };

  // New function to calculate match score across multiple locations
  const calculateMultiLocationMatchScore = (personLocation, orderLocations) => {
    if (!personLocation || orderLocations.length === 0) return 0;

    // Calculate match scores for each location
    const scores = orderLocations.map(loc => 
      calculateLocationMatchScore(personLocation, loc)
    );
    
    // Return highest match score - indicates person matches at least one location well
    // Alternatively, we could use average score or weighted approach
    return Math.max(...scores);
  };

  // Get detailed location scores for all locations
  const getDetailedLocationScores = (personLocation) => {
    if (!personLocation || orderLocations.length === 0) return [];
    
    return orderLocations.map(loc => ({
      location: loc,
      score: calculateLocationMatchScore(personLocation, loc)
    }));
  };

  // Modified to send request AND update the order to avoid duplication
  const sendDeliveryRequest = async (targetOrderId, deliveryPersonId, deliveryPersonEmail) => {
    try {
      // Get order details first
      const orderRef = doc(db, 'orders', targetOrderId);
      const orderSnap = await getDoc(orderRef);
      await updateDoc(orderRef, {
        hasActiveDeliveryRequest: true
      });
      if (!orderSnap.exists()) {
        toast.error('Order not found');
        return;
      }
      
      const orderData = orderSnap.data();
      
      if (orderData.deliveryRequestSent) {
        toast.error('A delivery request has already been sent for this order');
        return;
      }
      
      // Extract locations data from order
      const orderLocs = orderData.locations || 
                        (orderData.items && hasMultipleLocations ? 
                          extractLocationsFromItems(orderData.items) : 
                          [orderData.deliveryLocation || orderData.location || '']);
      
      // 1. Create a delivery request in the deliveryRequests collection
      await addDoc(collection(db, 'deliveryRequests'), {
        orderId: targetOrderId,
        deliveryPersonId: deliveryPersonId,
        deliveryPersonEmail: deliveryPersonEmail,
        orderLocation: orderData.deliveryLocation || orderData.location || '',
        orderLocations: orderLocs, // Include all locations
        orderTotal: orderData.total || 0,
        orderItems: orderData.items?.length || 0,
        status: 'pending', // pending, accepted, rejected
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid || 'system',
        hasMultipleLocations: orderData.hasMultipleLocations || hasMultipleLocations || false
      });
      
      // 2. Update the order to mark that a delivery request has been sent
      await updateDoc(orderRef, {
        deliveryRequestSent: true,
        lastUpdated: new Date().toISOString(),
        deliveryPersonRequested: deliveryPersonEmail
        // Don't change order status yet - it stays pending until accepted
      });
      
      toast.success('Delivery request sent successfully');
      
      // If this is in checkout/cart mode, call the onAssign callback to continue
      if (onAssign && targetOrderId === orderId) {
        onAssign();
      }
    } catch (error) {
      console.error('Error sending delivery request:', error);
      toast.error('Failed to send delivery request');
    }
  };

  // Extract locations from order items if available
  const extractLocationsFromItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    
    // Extract unique locations from items
    const locations = new Set();
    
    items.forEach(item => {
      if (item.location) locations.add(item.location);
      if (item.vendorLocation) locations.add(item.vendorLocation);
      if (item.storeLocation) locations.add(item.storeLocation);
    });
    
    return Array.from(locations);
  };

  // Filter delivery persons based on search term and location proximity
  const filteredDeliveryPersons = availableDeliveryPersons.filter(person => {
    // Search term filter
    const emailMatch = person.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const locationMatch = person.location?.toLowerCase().includes(searchTerm.toLowerCase());
    const searchMatch = emailMatch || locationMatch;
    
    // If no locations specified, just use search term
    if (orderLocations.length === 0) {
      return searchMatch;
    }
    
    // For multiple locations, we'll check if the person matches ANY location well enough
    const matchScore = calculateMultiLocationMatchScore(person.location, orderLocations);
    
    // Apply both filters - search term and location proximity
    return searchMatch && (matchScore >= locationMatchThreshold);
  });

  // Sort delivery persons by location relevance
  const sortedDeliveryPersons = [...filteredDeliveryPersons].sort((a, b) => {
    if (orderLocations.length > 0) {
      const scoreA = calculateMultiLocationMatchScore(a.location, orderLocations);
      const scoreB = calculateMultiLocationMatchScore(b.location, orderLocations);
      
      // Higher score comes first
      return scoreB - scoreA;
    }
    return 0;
  });

  // Helper function to determine match level for display
  const getLocationMatchLevel = (personLocation) => {
    if (!personLocation || orderLocations.length === 0) return 'low';
    
    const score = calculateMultiLocationMatchScore(personLocation, orderLocations);
    if (score >= 0.6) return 'high';
    if (score >= locationMatchThreshold) return 'medium';
    return 'low';
  };

  if (loading) {
    return <div className="text-center py-4">Loading delivery personnel...</div>;
  }

 // Only the return part of DeliveryAssignmentPanel component with improved responsive design
// Checkout/Cart Mode - Simplified view for assigning to a new order
if (orderId) {
  return (
    <div className="w-full bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Send Delivery Request</h2>
      
      <div className="mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-3">
          <h3 className="font-medium text-sm sm:text-base">Available Delivery Personnel ({filteredDeliveryPersons.length} of {availableDeliveryPersons.length})</h3>
          <div className="w-full sm:w-1/2">
            <div className="flex flex-col xs:flex-row gap-2 w-full">
              <input
                type="text"
                placeholder="Search by email or location..."
                className="flex-1 p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select 
                className="p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
                value={locationMatchThreshold}
                onChange={(e) => setLocationMatchThreshold(parseFloat(e.target.value))}
              >
                <option value="0.1">Low Match (More options)</option>
                <option value="0.3">Medium Match</option>
                <option value="0.5">High Match (Fewer options)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-md mb-3 sm:mb-4">
          {orderLocations.length > 0 ? (
            <>
              <p className="text-blue-700 text-xs sm:text-sm font-medium mb-2">
                Order Locations ({orderLocations.length}):
              </p>
              <ul className="text-blue-700 text-xs sm:text-sm space-y-1 pl-4 sm:pl-5 list-disc">
                {orderLocations.map((loc, index) => (
                  <li key={index} className="break-words">{loc}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-blue-700 text-xs sm:text-sm">
              <span className="font-medium">Order Location:</span> Not specified
            </p>
          )}
          
          {hasMultipleLocations && (
            <p className="text-yellow-700 text-xs sm:text-sm mt-2 sm:mt-3">
              <span className="font-medium">Note:</span> This order contains items from multiple locations.
              The delivery person will need to pick up from different places.
            </p>
          )}
        </div>
        
        {sortedDeliveryPersons.length === 0 ? (
          <div className="p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-700 text-sm">No delivery personnel available near these locations right now.</p>
            <p className="text-xs sm:text-sm text-yellow-600 mt-1">The order will remain in pending status until assigned.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {sortedDeliveryPersons.map((person) => {
              // Get match level for visual indicator
              const matchLevel = getLocationMatchLevel(person.location);
              const bestMatchScore = calculateMultiLocationMatchScore(person.location, orderLocations);
              const detailedScores = getDetailedLocationScores(person.location);
              
              return (
                <div key={person.id} className={`border rounded-lg p-2 sm:p-3 ${
                  matchLevel === 'high' ? 'bg-green-50 border-green-200' : 
                  matchLevel === 'medium' ? 'bg-yellow-50 border-yellow-200' : 
                  'bg-gray-50 border-gray-200'
                } hover:bg-opacity-80 transition-colors`}>
                  <div className="flex flex-col xs:flex-row justify-between items-start gap-1 sm:gap-2">
                    <div className="w-full xs:w-auto">
                      <h4 className="font-medium break-all text-sm sm:text-base">{person.email}</h4>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1">
                        Last updated: {new Date(person.lastUpdated).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-row xs:flex-col items-start xs:items-end gap-1 mt-1 xs:mt-0 w-full xs:w-auto">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Available
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium 
                        ${matchLevel === 'high' ? 'bg-green-100 text-green-800' : 
                          matchLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {matchLevel === 'high' ? 'Excellent match' : 
                         matchLevel === 'medium' ? 'Location match' : 
                         'Different area'} ({Math.round(bestMatchScore * 100)}%)
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <h5 className="text-xs sm:text-sm font-medium text-gray-700">Delivery Person Location:</h5>
                    <p className="text-xs sm:text-sm mt-0.5 sm:mt-1 break-words">{person.location}</p>
                  </div>

                  {hasMultipleLocations && detailedScores.length > 0 && (
                    <div className="mt-2 sm:mt-3 bg-gray-50 p-1.5 sm:p-2 rounded border border-gray-100">
                      <h5 className="text-xs font-medium text-gray-700 mb-0.5 sm:mb-1">Location Match Scores:</h5>
                      <div className="space-y-0.5 sm:space-y-1">
                        {detailedScores.map((score, index) => (
                          <div key={index} className="flex justify-between text-xs">
                            <span className="truncate max-w-xs">{score.location}</span>
                            <span className={
                              score.score >= 0.6 ? 'text-green-600 font-medium' : 
                              score.score >= 0.3 ? 'text-yellow-600' : 'text-gray-500'
                            }>{Math.round(score.score * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button
                    className={`mt-2 sm:mt-3 w-full ${
                      matchLevel === 'high' ? 'bg-green-500 hover:bg-green-600' :
                      matchLevel === 'medium' ? 'bg-blue-500 hover:bg-blue-600' :
                      'bg-gray-500 hover:bg-gray-600'
                    } text-white py-1.5 sm:py-2 px-3 sm:px-4 rounded-md transition-colors text-xs sm:text-sm`}
                    onClick={() => sendDeliveryRequest(orderId, person.id, person.email)}
                  >
                    Send Request
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Admin/Management View - Full functionality for managing all orders
return (
  <div className="w-full bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
    <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Search someone available</h2>
    
    <div className="mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 mb-3">
        <h3 className="font-medium text-sm sm:text-base">Available Delivery Personnel ({filteredDeliveryPersons.length} of {availableDeliveryPersons.length})</h3>
        <div className="w-full sm:w-1/2">
          <div className="flex flex-col xs:flex-row gap-2 w-full">
            <input
              type="text"
              placeholder="Search by email or location..."
              className="flex-1 p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select 
              className="p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm"
              value={locationMatchThreshold}
              onChange={(e) => setLocationMatchThreshold(parseFloat(e.target.value))}
            >
              <option value="0.1">Low Match (More options)</option>
              <option value="0.3">Medium Match</option>
              <option value="0.5">High Match (Fewer options)</option>
            </select>
          </div>
        </div>
      </div>
      
      {sortedDeliveryPersons.length === 0 ? (
        <p className="text-gray-500 py-2 text-sm">No delivery personnel available{searchTerm ? ' matching your search' : ''}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {sortedDeliveryPersons.map((person) => (
            <div key={person.id} className="border rounded-lg p-2 sm:p-3 bg-gray-50">
              <div className="flex flex-col xs:flex-row justify-between items-start gap-1 sm:gap-2">
                <div className="w-full xs:w-auto">
                  <h4 className="font-medium break-all text-sm sm:text-base">{person.email}</h4>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Last updated: {new Date(person.lastUpdated).toLocaleString()}</p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1 xs:mt-0">
                  Available
                </span>
              </div>
              <div className="mt-2">
                <h5 className="text-xs sm:text-sm font-medium text-gray-700">Location:</h5>
                <p className="text-xs sm:text-sm mt-0.5 sm:mt-1 break-words">{person.location}</p>
              </div>
              
              {pendingOrders.length > 0 && (
                <div className="mt-2 sm:mt-3">
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Send Request:</label>
                  <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                    {pendingOrders.slice(0, 3).map((order) => {
                      // Skip orders that already have delivery requests sent
                      if (order.deliveryRequestSent) {
                        return null;
                      }
                      
                      // Extract all locations from the order
                      const orderLocs = order.locations || 
                                        (order.hasMultipleLocations && order.items ? 
                                          extractLocationsFromItems(order.items) : 
                                          [order.deliveryLocation || order.location || '']);
                      
                      // Calculate best location match score
                      const matchScore = calculateMultiLocationMatchScore(person.location, orderLocs);
                      const matchLevel = matchScore >= 0.6 ? 'high' : 
                                         matchScore >= 0.3 ? 'medium' : 'low';
                      
                      // Display multi-location indicator
                      const hasMulti = orderLocs.length > 1;
                      
                      return (
                        <button
                          key={order.id}
                          onClick={() => sendDeliveryRequest(order.id, person.id, person.email)}
                          className={`${
                            matchLevel === 'high' ? 'bg-green-500 hover:bg-green-600' : 
                            matchLevel === 'medium' ? 'bg-blue-500 hover:bg-blue-600' :
                            'bg-gray-500 hover:bg-gray-600'
                          } text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded transition-colors flex items-center`}
                          title={`Order ID: ${order.id}
${hasMulti ? 'Multiple Locations' : `Location: ${orderLocs[0] || 'N/A'}`}
Match score: ${Math.round(matchScore * 100)}%`}
                        >
                          {order.id.substring(0, 6)}...
                          {matchLevel === 'high' && '✓'}
                          {hasMulti && (
                            <span className="ml-1 inline-flex items-center justify-center w-3 h-3 sm:w-4 sm:h-4 bg-yellow-200 text-yellow-800 rounded-full text-xxs">
                              {orderLocs.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {pendingOrders.filter(o => !o.deliveryRequestSent).length > 3 && (
                      <span className="text-xs text-gray-500 self-center">+{pendingOrders.filter(o => !o.deliveryRequestSent).length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    
    <div className="overflow-x-auto">
      <h3 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base">Pending Orders ({pendingOrders.length})</h3>
      {pendingOrders.length === 0 ? (
        <p className="text-gray-500 py-2 text-sm">No pending orders</p>
      ) : (
        <div className="min-w-full inline-block align-middle">
          <div className="overflow-hidden border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xxs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xxs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xxs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xxs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xxs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left text-xxs sm:text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingOrders.map((order) => {
                  // Extract all locations for each order
                  const orderLocs = order.locations || 
                                    (order.hasMultipleLocations && order.items ? 
                                      extractLocationsFromItems(order.items) : 
                                      [order.deliveryLocation || order.location || '']);
                  
                  const hasMulti = orderLocs.length > 1;
                  
                  return (
                    <tr key={order.id}>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 whitespace-nowrap text-xs sm:text-sm">{order.id.substring(0, 8)}...</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                        {hasMulti ? (
                          <div className="flex items-center">
                            <span className="truncate max-w-[100px] sm:max-w-[150px]">{orderLocs[0] || 'N/A'}</span>
                            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 bg-yellow-100 text-yellow-800 rounded-full text-xxs sm:text-xs font-medium">
                              +{orderLocs.length - 1}
                            </span>
                          </div>
                        ) : (
                          <span className="max-w-[120px] sm:max-w-[200px] truncate">{orderLocs[0] || 'N/A'}</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">{order.items?.length || 0} items</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">৳{order.total?.toFixed(2) || '0.00'}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                        {order.deliveryRequestSent ? (
                          <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xxs sm:text-xs font-medium bg-blue-100 text-blue-800">
                            Request Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xxs sm:text-xs font-medium bg-yellow-100 text-yellow-800">
                            Needs Delivery
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                        {!order.deliveryRequestSent ? (
                          <select
                            className="text-xs sm:text-sm border border-gray-300 rounded p-0.5 sm:p-1 w-full max-w-[150px] sm:max-w-[200px]"
                            onChange={(e) => {
                              if (e.target.value) {
                                const [id, email] = e.target.value.split('|');
                                sendDeliveryRequest(order.id, id, email);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>Send request to...</option>
                            {sortedDeliveryPersons.map((person) => {
                              // Calculate location match score against all locations
                              const orderLocs = order.locations || 
                                               (order.hasMultipleLocations && order.items ? 
                                                 extractLocationsFromItems(order.items) : 
                                                 [order.deliveryLocation || order.location || '']);
                              
                              const matchScore = calculateMultiLocationMatchScore(person.location, orderLocs);
                              const bestMatch = Math.round(matchScore * 100);
                              
                              // Show individual location matches in tooltip
                              const locationMatches = orderLocs.map(loc => {
                                const score = calculateLocationMatchScore(person.location, loc);
                                return `${loc}: ${Math.round(score * 100)}%`;
                              }).join('\n');
                              
                              return (
                                <option 
                                  key={person.id} 
                                  value={`${person.id}|${person.email}`}
                                  title={locationMatches}
                                >
                                  {person.email} {matchScore >= 0.3 ? 
                                    (orderLocs.length > 1 ? `(${bestMatch}% best)` : `(${bestMatch}%)`) : ''}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <span className="text-gray-500 text-xs sm:text-sm">
                            Requested: {order.deliveryPersonRequested?.split('@')[0] || 'Unknown'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </div>
);
}

export default DeliveryAssignmentPanel;