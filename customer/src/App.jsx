import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import Product from './components/Product';

import VerificationReminder from './pages/VerificationReminder';
import ProtectedRoute from './components/ProtectedRoute';


function App() {
  const [cartItems, setCartItems] = useState([]);

  const handleAddToCart = (product) => {
    setCartItems(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + (product.quantity || 1) }
            : item
        );
      }
      return [...prev, { ...product, quantity: product.quantity || 1 }];
    });
  };

  const handleRemoveFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.id !== productId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        
        <Routes>
        <Route path="/verify-email" element={<VerificationReminder />} />
          
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/product/:productId" element={
            <ProtectedRoute>
               <Product onAddToCart={handleAddToCart} />
               </ProtectedRoute>
            
          }/>
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard
               cartItems={cartItems} 
               onAddToCart={handleAddToCart} 
               onRemoveFromCart={handleRemoveFromCart} 
               onClearCart={handleClearCart}
              />
            </ProtectedRoute>
          } />
        </Routes>
        <Toaster position="bottom-right" />
      </div>
    </Router>
  );
}

export default App;