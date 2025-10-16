import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function DeliveryEarnings() {
  const [earnings, setEarnings] = useState({
    total: 0,
    adminFee: 0,
    netEarnings: 0,
    paid: 0,
    pending: 0,
    listedPending: 0,
    nonListedPending: 0,
    completedDeliveries: 0,
    paymentDetails: null
  });
  const [monthlyEarnings, setMonthlyEarnings] = useState({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('total'); // 'total' or 'monthly'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // Format: YYYY-MM
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    paymentMethod: 'onhand',
    receiverName: '',
    phoneNumber: '',
    transactionId: ''
  });
  const [listedOrders, setListedOrders] = useState([]);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser?.uid) {
      fetchDeliveryEarnings();
    }
  }, [currentUser]);

  const fetchDeliveryEarnings = async () => {
    try {
      setLoading(true);
      // Get all completed orders delivered by this person
      const q = query(
        collection(db, 'orders'),
        where('deliveryPersonId', '==', currentUser.uid),
        where('status', '==', 'completed')
      );
      
      const snapshot = await getDocs(q);
      
      let totalEarnings = 0;
      let paidToAdmin = 0;
      let listedPending = 0;
      let nonListedPending = 0;
      let completedCount = snapshot.docs.length;
      let paymentDetails = null;
      let listedOrdersArray = [];
      let hasSubmittedForm = false;
      
      // For monthly tracking
      const months = {};
      
      snapshot.docs.forEach(doc => {
        const order = doc.data();
        if (order.deliveryCharge) {
          totalEarnings += order.deliveryCharge;
          const adminFeeForOrder = order.deliveryCharge * 0.2;
          
          // Check if admin payment is confirmed
          if (order.adminPaymentConfirmed) {
            paidToAdmin += adminFeeForOrder;
          } else if (order.paymentListed) {
            listedPending += adminFeeForOrder;
            listedOrdersArray.push({
              id: doc.id,
              ...order
            });
            
            // Check if payment form has been submitted
            if (order.paymentFormSubmitted) {
              hasSubmittedForm = true;
            }
            
            // Capture payment details from the first listed order
            if (!paymentDetails && order.paymentDetails) {
              paymentDetails = order.paymentDetails;
            }
            
          } else {
            nonListedPending += adminFeeForOrder;
          }
          
          // Process for monthly tracking
          if (order.completedAt) {
            const date = new Date(order.completedAt.toDate());
            const monthKey = date.toISOString().substring(0, 7); // Format: YYYY-MM
            
            if (!months[monthKey]) {
              months[monthKey] = {
                total: 0,
                adminFee: 0,
                netEarnings: 0,
                paid: 0,
                pending: 0,
                listedPending: 0,
                nonListedPending: 0,
                completedDeliveries: 0,
                monthName: date.toLocaleString('default', { month: 'long' }),
                year: date.getFullYear()
              };
            }
            
            months[monthKey].total += order.deliveryCharge;
            months[monthKey].adminFee += adminFeeForOrder;
            months[monthKey].netEarnings += (order.deliveryCharge - adminFeeForOrder);
            months[monthKey].completedDeliveries += 1;
            
            if (order.adminPaymentConfirmed) {
              months[monthKey].paid += adminFeeForOrder;
            } else if (order.paymentListed) {
              months[monthKey].listedPending += adminFeeForOrder;
            } else {
              months[monthKey].nonListedPending += adminFeeForOrder;
            }
            
            months[monthKey].pending = months[monthKey].adminFee - months[monthKey].paid;
          }
        }
      });
      
      const adminFee = totalEarnings * 0.2; // 20% of total earnings
      
      setEarnings({
        total: totalEarnings,
        adminFee: adminFee,
        netEarnings: totalEarnings - adminFee,
        paid: paidToAdmin,
        pending: adminFee - paidToAdmin,
        listedPending: listedPending,
        nonListedPending: nonListedPending,
        completedDeliveries: completedCount,
        paymentDetails: paymentDetails
      });
      
      setListedOrders(listedOrdersArray);
      setMonthlyEarnings(months);
      setFormSubmitted(hasSubmittedForm);
      
    } catch (error) {
      console.error('Error fetching earnings:', error);
      toast.error('Failed to load earnings data');
    } finally {
      setLoading(false);
    }
  };

  const getMonthOptions = () => {
    const options = Object.keys(monthlyEarnings).sort().reverse().map(key => {
      const { monthName, year } = monthlyEarnings[key];
      return (
        <option key={key} value={key}>
          {monthName} {year}
        </option>
      );
    });
    
    return options;
  };

  const handleViewChange = (e) => {
    setViewMode(e.target.value);
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };
  
  const openFormModal = () => {
    setIsFormModalOpen(true);
  };
  
  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setPaymentFormData({
      paymentMethod: 'onhand',
      receiverName: '',
      phoneNumber: '',
      transactionId: ''
    });
  };
  
  const handleFormChange = (e) => {
    setPaymentFormData({
      ...paymentFormData,
      [e.target.name]: e.target.value
    });
  };
  
  const handlePaymentConfirmation = async (e) => {
    e.preventDefault();
    
    try {
      // Validation based on payment method
      if (paymentFormData.paymentMethod === 'onhand' && !paymentFormData.receiverName) {
        toast.error('Please enter the receiver name');
        return;
      } else if (paymentFormData.paymentMethod !== 'onhand') {
        if (!paymentFormData.phoneNumber) {
          toast.error('Please enter the phone number');
          return;
        }
        if (!paymentFormData.transactionId) {
          toast.error('Please enter the transaction ID');
          return;
        }
      }
      
      // Create payment form response document
      await addDoc(collection(db, 'paymentFormResponses'), {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        amount: earnings.listedPending,
        paymentMethod: paymentFormData.paymentMethod,
        receiverName: paymentFormData.receiverName || null,
        phoneNumber: paymentFormData.phoneNumber || null,
        transactionId: paymentFormData.transactionId || null,
        orderIds: listedOrders.map(order => order.id),
        submittedAt: new Date(),
        status: 'pending', // pending, confirmed, rejected
        read: false // Add this to track if admin has read it
      });
      
      // Update orders to mark that payment form has been submitted
      const batch = writeBatch(db);
      
      listedOrders.forEach(order => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, { 
          paymentFormSubmitted: true,
          paymentFormSubmittedAt: new Date()
        });
      });
      
      await batch.commit();
      
      toast.success('Payment confirmation submitted successfully');
      setFormSubmitted(true);
      closeFormModal();
      fetchDeliveryEarnings(); // Refresh the data
      
    } catch (error) {
      console.error('Error submitting payment form:', error);
      toast.error('Failed to submit payment form');
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading earnings data...</div>;
  }

  const currentEarningsData = viewMode === 'monthly' && monthlyEarnings[selectedMonth] 
    ? monthlyEarnings[selectedMonth] 
    : earnings;

  return (
    <div className="card p-4">
      <h2 className="text-xl font-bold mb-4">Your Delivery Earnings</h2>
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <button 
            className={`px-3 py-1 rounded-md ${viewMode === 'total' ? 'bg-[#758360] text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('total')}
          >
            All Time
          </button>
          <button 
            className={`px-3 py-1 rounded-md ${viewMode === 'monthly' ? 'bg-[#758360] text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('monthly')}
          >
            Monthly
          </button>
        </div>
        
        {viewMode === 'monthly' && (
          <select 
            className="border rounded-md p-1"
            value={selectedMonth}
            onChange={handleMonthChange}
          >
            {getMonthOptions()}
          </select>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Completed Deliveries</p>
          <p className="text-2xl font-bold text-gray-700">{currentEarningsData.completedDeliveries}</p>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-800">Total Earned</p>
          <p className="text-2xl font-bold text-green-700">৳{currentEarningsData.total.toFixed(2)}</p>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-red-800">Admin Fee (20%)</p>
          <p className="text-2xl font-bold text-red-700">৳{currentEarningsData.adminFee.toFixed(2)}</p>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">Your Net Earnings</p>
          <p className="text-2xl font-bold text-blue-700">৳{currentEarningsData.netEarnings.toFixed(2)}</p>
        </div>
      </div>
      
      {currentEarningsData.listedPending > 0 ? (
        <div className="bg-green-50 p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-green-800">Payment Listed (Pending Confirmation)</h3>
              <p className="text-xl font-bold text-green-700">৳{currentEarningsData.listedPending.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Unlisted Pending</p>
              <p className="font-medium">৳{currentEarningsData.nonListedPending.toFixed(2)}</p>
            </div>
          </div>
          
          {/* Payment details if available */}
          {earnings.paymentDetails && (
            <div className="mt-2 p-3 bg-green-100 rounded-md space-y-1">
              <p className="text-sm font-medium text-green-800">Payment Details:</p>

              {earnings.paymentDetails.bkashNumber && (
                <p className="text-sm text-green-700"> bKash: {earnings.paymentDetails.bkashNumber}</p>
              )}
              {earnings.paymentDetails.nagadNumber && (
                <p className="text-sm text-green-700"> Nagad: {earnings.paymentDetails.nagadNumber}</p>
              )}
              {earnings.paymentDetails.rocketNumber && (
                <p className="text-sm text-green-700">Rocket: {earnings.paymentDetails.rocketNumber}</p>
              )}
              {earnings.paymentDetails.receiverName && (
                <p className="text-sm text-green-700">Receiver: {earnings.paymentDetails.receiverName}</p>
              )}
              {earnings.paymentDetails.note && (
                <p className="text-sm italic text-green-700">Note: {earnings.paymentDetails.note}</p>
              )}
            </div>
          )}
          
          {formSubmitted ? (
            <div className="mt-4 p-3 bg-blue-100 rounded-md">
              <p className="text-sm font-medium text-blue-800">
                <span className="inline-block animate-pulse mr-2">●</span>
                Payment confirmation submitted. Waiting for admin approval.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-green-600 mt-2">
                This amount has been marked as a pending payment. Please pay using the provided payment method and confirm your payment by filling out the form. Once your payment is confirmed by the admin, this form will disappear.
              </p>
              
              <button
                onClick={openFormModal}
                className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
              >
                Confirm Payment Details
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-yellow-800">Pending Payment to Admin</h3>
              <p className="text-xl font-bold text-yellow-700">৳{currentEarningsData.pending.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Already Paid</p>
              <p className="font-medium">৳{currentEarningsData.paid.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
      
      <p className="text-sm text-gray-500 mt-2">
        Note: 20% of all delivery charges goes to the admin. Please contact admin for payment arrangements.
      </p>
      
      {/* Payment Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Confirm Payment</h3>
            
            <form onSubmit={handlePaymentConfirmation}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Amount Paid:</label>
                <div className="font-bold text-lg">৳{earnings.listedPending.toFixed(2)}</div>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Payment Method:</label>
                <select 
                  name="paymentMethod"
                  className="w-full p-2 border rounded-md"
                  value={paymentFormData.paymentMethod}
                  onChange={handleFormChange}
                >
                  <option value="onhand">On Hand</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>
              </div>
              
              {paymentFormData.paymentMethod === 'onhand' ? (
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Receiver Name:</label>
                  <input 
                    type="text"
                    name="receiverName"
                    value={paymentFormData.receiverName}
                    onChange={handleFormChange}
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter receiver's name"
                  />
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Phone Number:</label>
                    <input 
                      type="text"
                      name="phoneNumber"
                      value={paymentFormData.phoneNumber}
                      onChange={handleFormChange}
                      className="w-full p-2 border rounded-md"
                      placeholder="Enter phone number"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Transaction ID:</label>
                    <input 
                      type="text"
                      name="transactionId"
                      value={paymentFormData.transactionId}
                      onChange={handleFormChange}
                      className="w-full p-2 border rounded-md"
                      placeholder="Enter transaction ID"
                    />
                  </div>
                </>
              )}
              
              <div className="flex justify-end mt-6 space-x-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliveryEarnings;