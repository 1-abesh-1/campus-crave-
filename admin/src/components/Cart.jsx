import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function Cart({ items, onRemoveFromCart, onClearCart }) {
  const [loading, setLoading] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const { currentUser } = useAuth();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryCharges = items.reduce((sum, item) => sum + (item.deliveryCharge || 0) * item.quantity, 0);
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
        items: items,
        subtotal: subtotal,
        deliveryCharge: deliveryCharges,
        total: total,
        status: 'pending',
        customerConfirmed: false,
        contactNumber: contactNumber.trim(),
        deliveryLocation: deliveryLocation.trim(),
        createdAt: new Date().toISOString(),
        location: items[0]?.location || '' // Keeping this for backward compatibility
      });
      
      toast.success('Order placed successfully!');
      onClearCart();
      setContactNumber('');
      setDeliveryLocation('');
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Your Cart</h2>
      {items.length === 0 ? (
        <p className="text-gray-500">Your cart is empty</p>
      ) : (
        <>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-gray-500">
                    ${item.price} x {item.quantity}
                  </p>
                  <p className="text-sm text-gray-500">
                    Delivery: ${item.deliveryCharge}
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
          <div className="mt-6 pt-6 border-t space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Charges:</span>
              <span>${deliveryCharges.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            
            {/* Contact Number Field */}
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
            
            {/* Delivery Location Field */}
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
            
            <button
              onClick={handleCheckout}
              className="btn btn-primary w-full mt-4"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Checkout'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Cart;