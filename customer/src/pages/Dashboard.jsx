import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import ProductList from '../components/ProductList';
import Cart from '../components/Cart';
import OrderList from '../components/OrderList';
import DeliveryPanel from '../components/DeliveryPanel';

function Dashboard({ cartItems, onAddToCart, onRemoveFromCart, onClearCart }) {
  const [view, setView] = useState('products');
  const [userRoles, setUserRoles] = useState({ admin: false, delivery: false });
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchUserRoles = async () => {
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserRoles({
              admin: userData.admin || false,
              delivery: userData.delivery || false
            });
          }
        } catch (error) {
          console.error('Error fetching user roles:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUserRoles();
  }, [currentUser]);

  // Function to render the appropriate content based on current view
  const renderContent = () => {
    switch (view) {
      case 'products':
        return <ProductList onAddToCart={onAddToCart} />;
      case 'cart':
        return (
          <Cart
            items={cartItems}
            onRemoveFromCart={onRemoveFromCart}
            onClearCart={onClearCart}
          />
        );
      case 'orders':
        return <OrderList />;
      case 'delivery':
        return <DeliveryPanel />;
      default:
        return <ProductList onAddToCart={onAddToCart} />;
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="flex justify-center mb-6 border-b pb-4">
        <div className="flex space-x-8">
          <button
            onClick={() => setView('products')}
            className={`flex flex-col items-center p-2 ${view === 'products' ? 'text-[#a98467]' : 'text-gray-500 hover:text-blue-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="mt-1 text-sm">Products</span>
          </button>
          
          <button
            onClick={() => setView('cart')}
            className={`flex flex-col items-center p-2 ${view === 'cart' ? 'text-[#a98467]' : 'text-gray-500 hover:text-blue-600'}`}
          >
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs">
                  {cartItems.length}
                </span>
              )}
            </div>
            <span className="mt-1 text-sm">Cart</span>
          </button>
          
          <button
            onClick={() => setView('orders')}
            className={`flex flex-col items-center p-2 ${view === 'orders' ? 'text-[#a98467]' : 'text-gray-500 hover:text-blue-600'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="mt-1 text-sm">Orders</span>
          </button>
          
          {userRoles.delivery && (
            <button
              onClick={() => setView('delivery')}
              className={`flex flex-col items-center p-2 ${view === 'delivery' ? 'text-[#a98467]' : 'text-gray-500'}`}
              style={!view === 'delivery' ? { '--tw-text-opacity': 1, color: '#354f52' } : {}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="mt-1 text-sm">Delivery</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        {renderContent()}
      </div>
    </div>
  );
}

export default Dashboard;