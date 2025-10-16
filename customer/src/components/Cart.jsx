import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import DeliveryAssignmentPanel from './DeliveryAssignmentPanel';
import DisclaimerTag from './DisclaimerTag';

function Cart({ items, onRemoveFromCart, onClearCart }) {
  const [loading, setLoading] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const { currentUser } = useAuth();
  const [showDeliveryAssignment, setShowDeliveryAssignment] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [newOrderId, setNewOrderId] = useState(null);
  
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  // Calculate delivery charges with base charge plus additional charge for extra quantities
  const deliveryCharges = items.reduce((sum, item) => {
    // Apply full delivery charge for the first unit
    const baseCharge = item.deliveryCharge || 0;
    
    // Apply a reduced additional charge (e.g., 30% of the original) for each additional unit
    const additionalUnits = Math.max(0, item.quantity - 1);
    const additionalCharge = additionalUnits > 0 ? baseCharge * 0.3 * additionalUnits : 0;
    
    return sum + baseCharge + additionalCharge;
  }, 0);
  
  const total = subtotal + deliveryCharges;

  const handleCheckout = async () => {
    if (!contactNumber.trim()) {
      toast.error('Please provide a contact number');
      return;
    }
  
    if (!deliveryLocation.trim()) {
      toast.error('Please provide a delivery location');
      return;
    }
  
    try {
      setLoading(true);
      const orderRef = await addDoc(collection(db, 'orders'), {
        userId: currentUser.uid,
        customerEmail: currentUser.email,
        items: items,
        subtotal: subtotal,
        deliveryCharge: deliveryCharges,
        total: total,
        status: 'pending',
        customerConfirmed: false,
        contactNumber: contactNumber.trim(),
        deliveryLocation: deliveryLocation.trim(),
        createdAt: new Date().toISOString(),
        location: deliveryLocation.trim() // Update this to use deliveryLocation instead of items[0]?.location
      });
      
      toast.success('Order placed successfully!');
      setNewOrderId(orderRef.id);
      setOrderPlaced(true);
      setShowDeliveryAssignment(true);
      
      // Clear the cart immediately after order is placed
   
      setLoading(false);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order');
      setLoading(false);
    }
  };

  const handleAfterAssignment = () => {
    // Only hide the delivery assignment panel
    setShowDeliveryAssignment(false);
    // Reset form fields
    setContactNumber('');
    setDeliveryLocation('');
    onClearCart();
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Your Cart</h2>
      {(items.length === 0 && !orderPlaced) ? (
        <p className="text-gray-500">Your cart is empty. If you ordered anything, check its status in the orders.</p>
      ) : (
        <>
          {!orderPlaced && (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-gray-500">
                      ৳{item.price} x {item.quantity}
                    </p>
                    <p className="text-sm text-gray-500">
                      Delivery: ৳{item.deliveryCharge} + {item.quantity > 1 ? `৳${((item.deliveryCharge || 0) * 0.3 * (item.quantity - 1)).toFixed(2)} (extra)` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveFromCart(item.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-6 pt-6 border-t space-y-2">
            {!orderPlaced && (
              <>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>৳{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Charges:</span>
                  <span>৳{deliveryCharges.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>৳{total.toFixed(2)}</span>
                </div>
                
                <div className="mt-4">
                  <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    id="contactNumber"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your contact number"
                    required
                  />
                </div>
                
                <div className="mt-4">
                  <label htmlFor="deliveryLocation" className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Location *
                  </label>
                  <textarea
                    id="deliveryLocation"
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your delivery address"
                    rows="3"
                    required
                  />
                </div>
                <DisclaimerTag/><br/>
                <button
                  onClick={handleCheckout}
                  className="btn btn-primary w-full mt-4"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Checkout'}
                </button>
              </>
            )}

            {orderPlaced && showDeliveryAssignment && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-medium mb-4">Find Delivery Person</h3>
                <p className="mb-4 text-sm text-gray-600">
                Your order has been placed! You can now request the nearest person to pick it up, or leave it available for someone else to collect. </p>
                
                <DeliveryAssignmentPanel 
                  orderId={newOrderId} 
                  orderLocation={items[0]?.location} // Pass the correct delivery location here
                  onAssign={handleAfterAssignment}
                  hasMultipleLocations={items.length>1?true:false}
                  locationsList={items.length>1?items.map(item => item.location):[]}
                />
                

                <div className="mt-4 flex justify-end">
                 <button
                    onClick={handleAfterAssignment}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                   Skip for manual pickup by someone
                  </button>
                </div>
              </div>
            )}
          </div>
         
        </>
      )}
    </div>
  );
}

export default Cart;