import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import ProductList from '../components/ProductList';
import Cart from '../components/Cart';
import OrderList from '../components/OrderList';
import AdminPanel from '../components/AdminPanel';
import DeliveryPanel from '../components/DeliveryPanel';

function Dashboard() {
  const [cartItems, setCartItems] = useState([]);
  const [view, setView] = useState('products'); // 'products', 'cart', 'orders', 'admin', or 'delivery'
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

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  // Function to render the appropriate content based on current view
  const renderContent = () => {
    switch (view) {
     
      case 'admin':
        return <AdminPanel />;
      default:
        return <AdminPanel />;
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {userRoles.admin && (
            <button
              onClick={() => setView('admin')}
              className={`flex flex-col items-center p-2 ${view === 'admin' ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="mt-1 text-sm">Admin</span>
            </button>
          )}
          
      {renderContent()}
        </div>
  
  );
}

export default Dashboard;