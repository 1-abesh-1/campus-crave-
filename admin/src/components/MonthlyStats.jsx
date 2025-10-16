import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

function MonthlyStats() {
  const [stats, setStats] = useState({
    totalDeliveryCharges: 0,
    totalFoodPrice: 0,
    adminIncome: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    calculateMonthlyStats();
  }, []);

  const calculateMonthlyStats = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const ordersQuery = query(
        collection(db, 'orders'),
        where('status', '==', 'completed')
      );

      const snapshot = await getDocs(ordersQuery);
      console.log(`Found ${snapshot.docs.length} completed orders total`);

      let totalDeliveryCharges = 0;
      let totalFoodPrice = 0;
      let currentMonthOrders = 0;

      snapshot.docs.forEach(doc => {
        const order = doc.data();
        let orderDate;

        if (order.createdAt instanceof Timestamp) {
          orderDate = order.createdAt.toDate();
        } else if (typeof order.createdAt === 'string') {
          orderDate = new Date(order.createdAt);
        } else if (order.createdAt && order.createdAt.seconds) {
          orderDate = new Date(order.createdAt.seconds * 1000);
        } else {
          console.warn('Unrecognized date format for order:', doc.id, order.createdAt);
          return; // Skip this order
        }

        if (orderDate >= startOfMonth && orderDate < endOfMonth) {
          const delivery = Number(order.deliveryCharge) || 0;
          const subtotal = Number(order.subtotal) || 0;

          if (isNaN(delivery) || isNaN(subtotal)) {
            console.warn('Invalid price data in order:', doc.id, order);
            return;
          }

          currentMonthOrders++;
          totalDeliveryCharges += delivery;
          totalFoodPrice += subtotal;

          console.log(`Order ${doc.id}:`, {
            date: orderDate,
            deliveryCharge: delivery,
            subtotal: subtotal
          });
        }
      });

      const adminIncome = totalDeliveryCharges * 0.2;

      setStats({
        totalDeliveryCharges,
        totalFoodPrice,
        adminIncome
      });

      console.log('Stats calculated:', {
        totalDeliveryCharges,
        totalFoodPrice,
        adminIncome,
        totalCompletedOrders: snapshot.docs.length,
        currentMonthOrders
      });

    } catch (error) {
      console.error('Error calculating stats:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading stats...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="card p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-xl font-bold mb-4">Monthly Statistics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-800">Delivery Charges</h3>
          <p className="text-2xl font-bold text-blue-600">
          ৳{stats.totalDeliveryCharges.toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <h3 className="font-medium text-green-800">Food Sales</h3>
          <p className="text-2xl font-bold text-green-600">
          ৳{stats.totalFoodPrice.toFixed(2)}
          </p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <h3 className="font-medium text-purple-800">Admin Income (20% of Delivery)</h3>
          <p className="text-2xl font-bold text-purple-600">
          ৳{stats.adminIncome.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MonthlyStats;
