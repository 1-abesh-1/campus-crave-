import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function DeliveryPersonnelManagement() {
  const [deliveryPersonnel, setDeliveryPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentResponses, setSelectedPaymentResponses] = useState([]);
  const [isPaymentResponsesModalOpen, setIsPaymentResponsesModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('onhand');
  const { currentUser } = useAuth();
  const [paymentDetails, setPaymentDetails] = useState({
    bkashNumber: '',
    nagadNumber: '',
    rocketNumber: '',
    amount: 0,
    note: ''
  });

  useEffect(() => {
    fetchDeliveryPersonnel();
  }, [currentUser]);

  const fetchDeliveryPersonnel = async () => {
    try {
      setLoading(true);
      const usersQuery = query(
        collection(db, 'users'),
        where('delivery', '==', true)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const deliveryUserIds = usersSnapshot.docs.map(doc => doc.id);
      
      const personnelData = await Promise.all(
        deliveryUserIds.map(async (userId) => {
          const userDoc = await getDoc(doc(db, 'users', userId));
          const userData = userDoc.data() || {};
          
          const ordersQuery = query(
            collection(db, 'orders'),
            where('deliveryPersonId', '==', userId),
            where('status', '==', 'completed')
          );
          
          const ordersSnapshot = await getDocs(ordersQuery);
          
          let totalEarnings = 0;
          let adminFee = 0;
          let paidToAdmin = 0;
          let unpaidOrders = [];
          let listedOrders = [];
          let listedFee = 0;
          let nonListedFee = 0;
          let listedByCurrentAdmin = false;
          let phone = userData.phone || 'No phone';
          
          ordersSnapshot.docs.forEach(orderDoc => {
            const order = orderDoc.data();
            if (order.deliveryCharge) {
              totalEarnings += order.deliveryCharge;
              const orderAdminFee = order.deliveryCharge * 0.2;
              adminFee += orderAdminFee;
              
              if (order.adminPaymentConfirmed) {
                paidToAdmin += orderAdminFee;
              } else {
                unpaidOrders.push(orderDoc.id);
                if (order.paymentListed) {
                  listedFee += orderAdminFee;
                  listedOrders.push(orderDoc.id);
                  
                  // Check if current admin ID matches the one who listed it
                  if (currentUser && order.listedByAdminId === currentUser.uid) {
                    listedByCurrentAdmin = true;
                  }
                } else {
                  nonListedFee += orderAdminFee;
                }
              }
            }
          });
          
          const formResponsesQuery = query(
            collection(db, 'paymentFormResponses'),
            where('userId', '==', userId)
          );
          
          const formResponsesSnapshot = await getDocs(formResponsesQuery);
          const paymentResponses = formResponsesSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              submittedAt: doc.data().submittedAt?.toDate() || new Date()
            }))
            .sort((a, b) => b.submittedAt - a.submittedAt);
          
          return {
            userId,
            name: userData.name || 'Unknown',
            email: userData.email || 'No email',
            phone,
            listingStatus: listedByCurrentAdmin 
              ? 'Listed by you' 
              : (listedFee > 0 ? 'Listed by another admin' : 'Not listed'),
            isListedByCurrentAdmin: listedByCurrentAdmin,
            totalCompletedDeliveries: ordersSnapshot.docs.length,
            totalEarnings,
            adminFee,
            paidToAdmin,
            pendingPayment: adminFee - paidToAdmin,
            unpaidOrders,
            listedOrders,
            listedFee,
            nonListedFee,
            isActive: userData.delivery === true,
            isApproved: userData.isApproved === true,
            paymentResponses,
            hasNewResponse: paymentResponses.length > 0 && !paymentResponses[0].seen
          };
        })
      );
      
      setDeliveryPersonnel(personnelData);
    } catch (error) {
      console.error('Error fetching delivery personnel:', error);
      toast.error('Failed to load delivery personnel data');
    } finally {
      setLoading(false);
    }
  };

  const markResponseAsSeen = async (userId, responseId) => {
    try {
      const responseRef = doc(db, 'paymentFormResponses', responseId);
      await updateDoc(responseRef, {
        seen: true
      });
      
      setDeliveryPersonnel(prevPersonnel => 
        prevPersonnel.map(person => {
          if (person.userId === userId) {
            const updatedResponses = person.paymentResponses.map(response => 
              response.id === responseId ? { ...response, seen: true } : response
            );
            return {
              ...person,
              paymentResponses: updatedResponses,
              hasNewResponse: false
            };
          }
          return person;
        })
      );
      
      toast.success('Response marked as seen');
    } catch (error) {
      console.error('Error marking response as seen:', error);
      toast.error('Failed to update response status');
    }
  };

  const confirmPayment = async (userId, listedOrders) => {
    try {
      if (listedOrders.length === 0) {
        toast.error('No listed payments to confirm');
        return;
      }
      
      const batch = writeBatch(db);
      
      listedOrders.forEach(orderId => {
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, { 
          adminPaymentConfirmed: true,
          paymentListed: false,
          listedByAdminId: null
        });
      });
      
      await batch.commit();
      
      toast.success('Payment confirmed successfully');
      fetchDeliveryPersonnel();
      
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to confirm payment');
    }
  };
  
  const toggleDeliveryStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        delivery: newStatus
      });
      
      setDeliveryPersonnel(prevPersonnel => 
        prevPersonnel.map(person => 
          person.userId === userId 
            ? {...person, isActive: newStatus} 
            : person
        )
      );
      
      toast.success(`Delivery portal ${newStatus ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling delivery status:', error);
      toast.error('Failed to update delivery status');
    }
  };

  const toggleApprovalStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        isApproved: newStatus
      });
      
      setDeliveryPersonnel(prevPersonnel => 
        prevPersonnel.map(person => 
          person.userId === userId 
            ? {...person, isApproved: newStatus} 
            : person
        )
      );
      
      toast.success(`Delivery personnel ${newStatus ? 'approved' : 'unapproved'} successfully`);
    } catch (error) {
      console.error('Error toggling approval status:', error);
      toast.error('Failed to update approval status');
    }
  };

  const openPaymentModal = (user, nonListedFee) => {
    setSelectedUser(user);
    setPaymentDetails({
      ...paymentDetails,
      amount: nonListedFee
    });
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedUser(null);
    setPaymentMethod('onhand');
    setPaymentDetails({
      bkashNumber: '',
      nagadNumber: '',
      rocketNumber: '',
      amount: 0,
      note: ''
    });
  };

  const handlePaymentMethodChange = (e) => {
    setPaymentMethod(e.target.value);
  };

  const handlePaymentDetailsChange = (e) => {
    setPaymentDetails({
      ...paymentDetails,
      [e.target.name]: e.target.value
    });
  };

  const listPendingPayment = async (userId, unpaidOrders) => {
    try {
      if (!currentUser) {
        toast.error('You must be logged in to list payments');
        return;
      }

      const nonListedOrders = unpaidOrders.filter(orderId => {
        const person = deliveryPersonnel.find(p => p.userId === userId);
        return person && !person.listedOrders.includes(orderId);
      });
  
      if (nonListedOrders.length === 0) {
        toast.error('No unlisted payments to mark as pending');
        return;
      }
  
      const filteredPaymentDetails = {
        amount: paymentDetails.amount
      };
  
      if (paymentDetails.bkashNumber) {
        filteredPaymentDetails.bkashNumber = paymentDetails.bkashNumber;
      }
      if (paymentDetails.nagadNumber) {
        filteredPaymentDetails.nagadNumber = paymentDetails.nagadNumber;
      }
      if (paymentDetails.rocketNumber) {
        filteredPaymentDetails.rocketNumber = paymentDetails.rocketNumber;
      }
      if (paymentDetails.note) {
        filteredPaymentDetails.note = paymentDetails.note;
      }
  
      const batch = writeBatch(db);
  
      nonListedOrders.forEach(orderId => {
        const orderRef = doc(db, 'orders', orderId);
        batch.update(orderRef, {
          paymentListed: true,
          paymentDetails: filteredPaymentDetails,
          paymentListedAt: new Date(),
          listedByAdminId: currentUser.uid
        });
      });
  
      await batch.commit();
  
      toast.success('Pending payment listed successfully');
      closePaymentModal();
      fetchDeliveryPersonnel();
  
    } catch (error) {
      console.error('Error listing pending payment:', error);
      toast.error('Failed to list pending payment');
    }
  };
  
  const filteredPersonnel = deliveryPersonnel.filter(person => {
    return (
      person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      person.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (person.phone && person.phone.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  if (loading) {
    return <div className="text-center py-4">Loading delivery personnel data...</div>;
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Delivery Personnel Management</h2>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search delivery personnel..."
          className="input w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {filteredPersonnel.length === 0 ? (
        <p className="text-gray-500">No delivery personnel found</p>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listing Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Approval
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deliveries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Earnings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Fee (20%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listed Fee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPersonnel.map((person) => (
                  <tr key={person.userId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{person.name}</div>
                      <div className="text-sm text-gray-500">{person.email}</div>
                      <div className="text-sm text-gray-500">{person.userId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {person.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${
                        person.isListedByCurrentAdmin 
                          ? 'text-green-600 font-medium' 
                          : person.listedFee > 0 
                            ? 'text-blue-600' 
                            : 'text-gray-500'
                      }`}>
                        {person.listingStatus}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${person.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {person.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${person.isApproved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {person.isApproved ? 'Approved' : 'Not Approved'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {person.totalCompletedDeliveries}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ৳{person.totalEarnings.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ৳{person.adminFee.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-600">
                        ৳{person.pendingPayment.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-yellow-600">
                        ৳{person.listedFee.toFixed(2)}
                      </div>
                      {person.paymentResponses && person.paymentResponses.length > 0 && (
                        <div className="mt-1">
                          <button   
                            onClick={() => {
                              setSelectedPaymentResponses(person.paymentResponses);
                              setIsPaymentResponsesModalOpen(true);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            View {person.paymentResponses.length} payment responses
                            {person.hasNewResponse && (
                              <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                                New
                              </span>
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => toggleApprovalStatus(person.userId, person.isApproved)}
                          className={`${person.isApproved ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'} text-white py-1 px-3 rounded`}
                        >
                          {person.isApproved ? 'Remove Approval' : 'Approve'}
                        </button>
                        
                        {person.listedFee > 0 && (
                          <button
                            onClick={() => confirmPayment(person.userId, person.listedOrders)}
                            className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded"
                          >
                            Confirm Payment
                          </button>
                        )}
                        
                        {person.nonListedFee > 0 && (
                          <button
                            onClick={() => openPaymentModal(person, person.nonListedFee)}
                            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded"
                          >
                            List Pending
                          </button>
                        )}
                        
                        <button
                          onClick={() => toggleDeliveryStatus(person.userId, person.isActive)}
                          className={`${person.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white py-1 px-3 rounded`}
                        >
                          {person.isActive ? 'Disable Portal' : 'Enable Portal'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {isPaymentResponsesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
          <div className="flex justify-end mt-4">
            <button
                onClick={() => setIsPaymentResponsesModalOpen(false)}
                className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
              >
                Close
              </button>
            </div>
            <h3 className="text-lg font-bold mb-4">Payment Responses</h3>
            <ul className="space-y-4 text-sm">
              {selectedPaymentResponses.map((response, index) => (
                <li key={response.id || index} className="border p-4 rounded shadow-sm bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-gray-800 mb-2">Payment #{selectedPaymentResponses.length - index}</div>
                    {index === 0 && !response.seen && (
                      <button
                        onClick={() => markResponseAsSeen(response.userId, response.id)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded"
                      >
                        Mark as Seen
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-gray-700">
                    <div><span className="font-medium">User:</span> {response.userName}</div>
                    <div><span className="font-medium">User ID:</span> {response.userId}</div>
                    <div><span className="font-medium">Amount:</span> ৳{response.amount}</div>
                    <div><span className="font-medium">Payment Method:</span> {response.paymentMethod}</div>
                    <div><span className="font-medium">Phone Number:</span> {response.phoneNumber}</div>
                    <div><span className="font-medium">Transaction ID:</span> {response.transactionId}</div>
                    {response.receiverName && (
                      <div><span className="font-medium">Receiver Name:</span> {response.receiverName}</div>
                    )}
                    {response.orderIds?.length > 0 && (
                      <div>
                        <span className="font-medium">Order IDs:</span>
                        <ul className="list-disc ml-5">
                          {response.orderIds.map((orderId, i) => (
                            <li key={i}>{orderId}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {response.submittedAt && (
                      <div className="text-xs text-gray-500 mt-2">
                        Submitted At: {new Date(response.submittedAt).toLocaleString()}
                      </div>
                    )}
                    
                    <div className="mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${index === 0 && !response.seen ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                        {index === 0 && !response.seen ? 'New' : 'Seen'}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            
          </div>
        </div>
      )}
      
      {isPaymentModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">List Pending Payment for {selectedUser.name}</h3>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Amount to be paid:</label>
              <div className="font-bold text-lg">৳{paymentDetails.amount.toFixed(2)}</div>
            </div>
            
            <div className="mb-2 font-semibold text-gray-800">Payment Methods:</div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">bKash Number:</label>
              <input 
                type="text"
                name="bkashNumber"
                value={paymentDetails.bkashNumber}
                onChange={handlePaymentDetailsChange}
                className="w-full p-2 border rounded-md"
                placeholder="Enter bKash number"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Nagad Number:</label>
              <input 
                type="text"
                name="nagadNumber"
                value={paymentDetails.nagadNumber}
                onChange={handlePaymentDetailsChange}
                className="w-full p-2 border rounded-md"
                placeholder="Enter Nagad number"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Rocket Number:</label>
              <input 
                type="text"
                name="rocketNumber"
                value={paymentDetails.rocketNumber}
                onChange={handlePaymentDetailsChange}
                className="w-full p-2 border rounded-md"
                placeholder="Enter Rocket number"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Note / Remarks:</label>
              <textarea
                name="note"
                value={paymentDetails.note}
                onChange={handlePaymentDetailsChange}
                className="w-full p-2 border rounded-md"
                placeholder="Optional note about this payment"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end mt-6 space-x-2">
              <button
                onClick={closePaymentModal}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => listPendingPayment(selectedUser.userId, selectedUser.unpaidOrders)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
              >
                List Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliveryPersonnelManagement;