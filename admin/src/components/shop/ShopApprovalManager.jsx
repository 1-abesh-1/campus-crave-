import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, getDocs, doc, updateDoc, addDoc, where, orderBy } from 'firebase/firestore';
import { Store, CheckCircle, XCircle, Eye, Clock, Search, DollarSign, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

function ShopApprovalManager() {
  const [shops, setShops] = useState([]);
  const [paymentResponses, setPaymentResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [selectedShop, setSelectedShop] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'approved', 'rejected'
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all'); // 'all', 'pending', 'confirmed'
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentDetails, setPaymentDetails] = useState({
    bkashNumber: '',
    nagadNumber: '',
    rocketNumber: '',
    amount: 0,
    note: ''
  });

  useEffect(() => {
    fetchShops();
    fetchPaymentResponses();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all shops (not just pending ones)
      const shopsQuery = query(collection(db, 'shops'));
      
      const shopsSnapshot = await getDocs(shopsQuery);
      let shopsData = shopsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Manual sorting by createdAt
      shopsData = shopsData.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          const aDate = a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt;
          const bDate = b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt;
          return bDate - aDate; // Descending order
        }
        return 0;
      });
      
      setShops(shopsData);
    } catch (error) {
      console.error('Error fetching shops:', error);
      setError(error.message);
      toast.error('Failed to load shops');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentResponses = async () => {
    setLoadingPayments(true);
    try {
      // Fetch payment responses from a separate collection
      const paymentsQuery = query(
        collection(db, 'paymentResponses'),
        orderBy('submittedAt', 'desc')
      );
      
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setPaymentResponses(paymentsData);
    } catch (error) {
      console.error('Error fetching payment responses:', error);
      toast.error('Failed to load payment responses');
    } finally {
      setLoadingPayments(false);
    }
  };

  const updateShopStatus = async (shopId, newStatus) => {
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        status: newStatus
      });
      
      toast.success(`Shop ${newStatus} successfully`);
      
      // Update local state instead of removing
      setShops(prev => prev.map(shop => 
        shop.id === shopId ? {...shop, status: newStatus} : shop
      ));
      
      if (selectedShop?.id === shopId) {
        setSelectedShop(prev => ({...prev, status: newStatus}));
      }
    } catch (error) {
      console.error(`Error updating shop to ${newStatus}:`, error);
      toast.error(`Failed to update shop status`);
    }
  };

  const approveShop = (shopId) => updateShopStatus(shopId, 'approved');
  const rejectShop = (shopId) => updateShopStatus(shopId, 'rejected');
  const markAsPending = (shopId) => updateShopStatus(shopId, 'pending');

  const openDetailsModal = (shop) => {
    setSelectedShop(shop);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedShop(null);
  };
  
  const openPaymentModal = (shop) => {
    setSelectedShop(shop);
    setPaymentDetails({
      ...paymentDetails,
      amount: 0 // Set default amount - could be a fixed fee or calculated
    });
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentDetails({
      bkashNumber: '',
      nagadNumber: '',
      rocketNumber: '',
      amount: 0,
      note: ''
    });
  };

  const openPaymentDetailsModal = (payment) => {
    setSelectedPayment(payment);
    setIsPaymentDetailsModalOpen(true);
  };

  const closePaymentDetailsModal = () => {
    setIsPaymentDetailsModalOpen(false);
    setSelectedPayment(null);
  };

  const handlePaymentDetailsChange = (e) => {
    setPaymentDetails({
      ...paymentDetails,
      [e.target.name]: e.target.value
    });
  };

  const listPendingPayment = async (shopId) => {
    try {
      if (!paymentDetails.amount || paymentDetails.amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
      }

      // Prepare payment details object
      const filteredPaymentDetails = {
        amount: parseFloat(paymentDetails.amount)
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
  
      // Update shop with payment information
      await updateDoc(doc(db, 'shops', shopId), {
        utilityFeePayment: {
          paymentListed: true,
          paymentDetails: filteredPaymentDetails,
          listedAt: new Date(),
          paymentFormSubmitted: false,
          adminPaymentConfirmed: false
        }
      });
  
      toast.success('Utility fee payment listed successfully');
      closePaymentModal();
      
      // Refresh shops list
      fetchShops();
    } catch (error) {
      console.error('Error listing utility fee payment:', error);
      toast.error('Failed to list payment');
    }
  };

  const confirmUtilityPayment = async (shopId) => {
    try {
      await updateDoc(doc(db, 'shops', shopId), {
        'utilityFeePayment.adminPaymentConfirmed': true
      });
      
      toast.success('Payment confirmed successfully');
      fetchShops();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to confirm payment');
    }
  };

  const confirmPaymentResponse = async (paymentId) => {
    try {
      await updateDoc(doc(db, 'paymentResponses', paymentId), {
        status: 'confirmed',
        confirmedAt: new Date()
      });
      
      // Also update the shop's payment status if needed
      const payment = paymentResponses.find(p => p.id === paymentId);
      if (payment && payment.shopId) {
        await updateDoc(doc(db, 'shops', payment.shopId), {
          'utilityFeePayment.adminPaymentConfirmed': true,
          'utilityFeePayment.paymentFormSubmitted': true
        });
      }
      
      toast.success('Payment confirmed successfully');
      fetchPaymentResponses();
      fetchShops(); // Refresh shops to update their payment status
    } catch (error) {
      console.error('Error confirming payment response:', error);
      toast.error('Failed to confirm payment');
    }
  };

  const rejectPaymentResponse = async (paymentId) => {
    try {
      await updateDoc(doc(db, 'paymentResponses', paymentId), {
        status: 'rejected',
        rejectedAt: new Date()
      });
      
      toast.success('Payment rejected successfully');
      fetchPaymentResponses();
    } catch (error) {
      console.error('Error rejecting payment response:', error);
      toast.error('Failed to reject payment');
    }
  };

  // Search function
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  // Filter shops based on selected status and search query
  const filteredShops = shops.filter(shop => {
    // Status filter
    const matchesStatus = statusFilter === 'all' || shop.status === statusFilter;
    
    // Search filter - check if search query matches shop name or owner email
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (shop.name && shop.name.toLowerCase().includes(query)) || 
      (shop.ownerEmail && shop.ownerEmail.toLowerCase().includes(query));
    
    return matchesStatus && matchesSearch;
  });

  // Filter payment responses based on status
  const filteredPaymentResponses = paymentResponses.filter(payment => {
    return paymentStatusFilter === 'all' || payment.status === paymentStatusFilter;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm flex items-center"><Clock className="h-3 w-3 mr-1" /> Pending</span>;
      case 'approved':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Approved</span>;
      case 'rejected':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm flex items-center"><XCircle className="h-3 w-3 mr-1" /> Rejected</span>;
      case 'confirmed':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Confirmed</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">Unknown</span>;
    }
  };

  const getPaymentMethodBadge = (payment) => {
    if (payment.paymentMethod === 'bkash') {
      return <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-sm">bKash</span>;
    } else if (payment.paymentMethod === 'nagad') {
      return <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">Nagad</span>;
    } else if (payment.paymentMethod === 'rocket') {
      return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">Rocket</span>;
    } else {
      return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm">{payment.paymentMethod || 'Unknown'}</span>;
    }
  };

  // Find shop name by ID
  const getShopNameById = (shopId) => {
    const shop = shops.find(s => s.id === shopId);
    return shop ? shop.name : 'Unknown Shop';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#656d4a]"></div>
        <p className="mt-2 text-gray-500">Loading shops...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error: {error}</p>
          <button 
            onClick={fetchShops}
            className="mt-3 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-4">Shop Management</h3>
        
        {/* Search and filter controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search input */}
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by shop name or owner email"
              value={searchQuery}
              onChange={handleSearch}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          {/* Status filter */}
          <div className="flex items-center sm:w-auto">
            <span className="text-sm text-gray-600 mr-2 whitespace-nowrap">Filter by status:</span>
            <div className="relative inline-block flex-grow">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded leading-tight focus:outline-none focus:ring focus:border-blue-300"
              >
                <option value="all">All Shops</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Results count */}
      <div className="text-sm text-gray-600 mb-4">
        Showing {filteredShops.length} shop{filteredShops.length !== 1 ? 's' : ''}
        {searchQuery && <span> matching "{searchQuery}"</span>}
        {statusFilter !== 'all' && <span> with status: {statusFilter}</span>}
      </div>
      
      {filteredShops.length === 0 ? (
        <div className="text-center py-8">
          <Store className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No shops found with the current filters</p>
          {(searchQuery || statusFilter !== 'all') && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="mt-3 text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShops.map(shop => (
            <div key={shop.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div className="flex items-start space-x-3 mb-4 md:mb-0">
                  <div className="h-12 w-12 flex-shrink-0 bg-[#f8f9fa] rounded-lg overflow-hidden flex items-center justify-center">
                    {shop.logoUrl ? (
                      <img
                        src={shop.logoUrl}
                        alt={`${shop.name} logo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="h-6 w-6 text-[#656d4a]" />
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{shop.name}</h4>
                      {getStatusBadge(shop.status)}
                    </div>
                    <p className="text-sm text-gray-600">Owner: {shop.ownerEmail}</p>
                    <p className="text-sm text-gray-600">
                      Submitted: {shop.createdAt?.toDate ? shop.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openDetailsModal(shop)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Details
                  </button>
                  
                  <button
                    onClick={() => openPaymentModal(shop)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    List Payment
                  </button>
                  
                  {shop.status !== 'approved' && (
                    <button
                      onClick={() => approveShop(shop.id)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </button>
                  )}
                  
                  {shop.status !== 'rejected' && (
                    <button
                      onClick={() => rejectShop(shop.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </button>
                  )}
                  
                  {shop.status !== 'pending' && (
                    <button
                      onClick={() => markAsPending(shop.id)}
                      className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center"
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Mark Pending
                    </button>
                  )}
                </div>
              </div>
              
              {/* Payment Status Section */}
              {shop.utilityFeePayment && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-700">
                        Utility Fee Payment:
                      </span>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                        shop.utilityFeePayment.adminPaymentConfirmed 
                          ? 'bg-green-100 text-green-800' 
                          : shop.utilityFeePayment.paymentFormSubmitted 
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {shop.utilityFeePayment.adminPaymentConfirmed 
                          ? 'Confirmed' 
                          : shop.utilityFeePayment.paymentFormSubmitted 
                            ? 'Payment Form Submitted'
                            : 'Pending Payment'}
                      </span>
                      <span className="ml-2 text-sm font-medium">
                        Amount: ৳{shop.utilityFeePayment.paymentDetails?.amount || 0}
                      </span>
                    </div>
                    
                    {shop.utilityFeePayment.paymentFormSubmitted && !shop.utilityFeePayment.adminPaymentConfirmed && (
                      <button
                        onClick={() => confirmUtilityPayment(shop.id)}
                        className="mt-2 md:mt-0 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Confirm Payment
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Shop Details Modal */}
      {isDetailsModalOpen && selectedShop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold">Shop Details</h3>
                  {getStatusBadge(selectedShop.status)}
                </div>
                <button 
                  onClick={closeDetailsModal}
                  className="text-2xl text-gray-500 hover:text-gray-700"
                >
                  &times;
                </button>
              </div>
              
              {/* Banner Image */}
              <div className="h-40 rounded-lg overflow-hidden bg-[#f8f9fa] mb-4">
                {selectedShop.bannerUrl ? (
                  <img
                    src={selectedShop.bannerUrl}
                    alt={`${selectedShop.name} banner`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#e9edc9]">
                    <Store className="h-12 w-12 text-[#656d4a]" />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  {/* Logo */}
                  <div className="h-32 w-32 bg-[#f8f9fa] rounded-lg overflow-hidden mx-auto mb-4">
                    {selectedShop.logoUrl ? (
                      <img
                        src={selectedShop.logoUrl}
                        alt={`${selectedShop.name} logo`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#e9edc9]">
                        <Store className="h-12 w-12 text-[#656d4a]" />
                      </div>
                    )}
                  </div>
                  
                  {/* Shop Owner Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-700 mb-2">Owner Information</h4>
                    <p className="text-sm">
                      <span className="font-medium">Email:</span> {selectedShop.ownerEmail}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">User ID:</span> {selectedShop.ownerId}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">Phone:</span> {selectedShop.phone || 'Not provided'}
                    </p>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <h4 className="text-lg font-semibold">{selectedShop.name}</h4>
                  
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700">Description</h5>
                    <p className="text-gray-600 mt-1 whitespace-pre-line">
                      {selectedShop.description}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700">Address</h5>
                    <p className="text-gray-600 mt-1">
                      {selectedShop.address}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700">Delivery Options</h5>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedShop.deliveryOptions?.selfDelivery && (
                        <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-sm">
                          Self-delivery
                        </span>
                      )}
                      {selectedShop.deliveryOptions?.platformDelivery && (
                        <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-sm">
                          Platform delivery
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Payment Status in Modal */}
                  {selectedShop.utilityFeePayment && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h5 className="font-medium text-gray-700">Utility Fee Payment Status</h5>
                      <div className="mt-2 bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Amount:</span>
                          <span>৳{selectedShop.utilityFeePayment.paymentDetails?.amount || 0}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">Status:</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            selectedShop.utilityFeePayment.adminPaymentConfirmed 
                              ? 'bg-green-100 text-green-800' 
                              : selectedShop.utilityFeePayment.paymentFormSubmitted 
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {selectedShop.utilityFeePayment.adminPaymentConfirmed 
                              ? 'Confirmed' 
                              : selectedShop.utilityFeePayment.paymentFormSubmitted 
                                ? 'Payment Form Submitted'
                                : 'Pending Payment'}
                          </span>
                        </div>
                        {selectedShop.utilityFeePayment.paymentDetails && (
                          <div className="mt-2 text-sm">
                            <div className="font-medium mb-1">Payment Details:</div>
                            {selectedShop.utilityFeePayment.paymentDetails.bkashNumber && (
                              <div>bKash: {selectedShop.utilityFeePayment.paymentDetails.bkashNumber}</div>
                            )}
                            {selectedShop.utilityFeePayment.paymentDetails.nagadNumber && (
                              <div>Nagad: {selectedShop.utilityFeePayment.paymentDetails.nagadNumber}</div>
                            )}
                            {selectedShop.utilityFeePayment.paymentDetails.rocketNumber && (
                              <div>Rocket: {selectedShop.utilityFeePayment.paymentDetails.rocketNumber}</div>
                            )}
                            {selectedShop.utilityFeePayment.paymentDetails.note && (
                              <div>Note: {selectedShop.utilityFeePayment.paymentDetails.note}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap justify-end gap-3">
                    <button
                      onClick={closeDetailsModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                    
                    {selectedShop.status !== 'pending' && (
                      <button
                        onClick={() => markAsPending(selectedShop.id)}
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Mark Pending
                      </button>
                    )}
                    
                    {selectedShop.status !== 'rejected' && (
                      <button
                        onClick={() => rejectShop(selectedShop.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </button>
                    )}
                    
                    {selectedShop.status !== 'approved' && (
                      <button
                        onClick={() => approveShop(selectedShop.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Payment Modal */}
      {isPaymentModalOpen && selectedShop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">List Utility Fee Payment for {selectedShop.name}</h3>
            
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Amount to be paid:</label>
              <input 
                type="number"
                name="amount"
                value={paymentDetails.amount}
                onChange={handlePaymentDetailsChange}
                className="w-full p-2 border rounded-md"
                placeholder="Enter payment amount"
              />
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
                onClick={() => listPendingPayment(selectedShop.id)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
              >
                List Payment
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Payment Details Modal */}
      {isPaymentDetailsModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold">Payment Details</h3>
              <button 
                onClick={closePaymentDetailsModal}
                className="text-2xl text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Shop:</span>
                <span>{getShopNameById(selectedPayment.shopId)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Amount:</span>
                <span>৳{selectedPayment.amount}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Payment Method:</span>
                {getPaymentMethodBadge(selectedPayment)}
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Transaction ID:</span>
                <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                  {selectedPayment.transactionId}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Status:</span>
                {getStatusBadge(selectedPayment.status)}
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Submitted:</span>
                <span>
                  {selectedPayment.submittedAt?.toDate 
                    ? selectedPayment.submittedAt.toDate().toLocaleString() 
                    : 'N/A'}
                </span>
              </div>
              
              {selectedPayment.note && (
                <div className="mt-3">
                  <span className="font-medium">Note:</span>
                  <p className="mt-1 text-gray-600 bg-white p-2 rounded border border-gray-200">
                    {selectedPayment.note}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={closePaymentDetailsModal}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-md"
              >
                Close
              </button>
              
              {selectedPayment.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      rejectPaymentResponse(selectedPayment.id);
                      closePaymentDetailsModal();
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      confirmPaymentResponse(selectedPayment.id);
                      closePaymentDetailsModal();
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Payment Responses Manager */}
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4">Utility Fee Payment Responses</h3>
        
        {/* Payment status filter */}
        <div className="mb-4 flex items-center">
          <span className="text-sm text-gray-600 mr-2">Filter by payment status:</span>
          <div className="relative inline-block w-48">
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded leading-tight focus:outline-none focus:ring focus:border-blue-300"
            >
              <option value="all">All Payments</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shop
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingPayments ? (
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" colSpan="5">
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#656d4a]"></div>
                        <p className="mt-2 text-gray-500">Loading payment responses...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredPaymentResponses.length === 0 ? (
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" colSpan="5">
                      <div className="text-center py-4">
                        <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">No payment responses to display</p>
                        {paymentStatusFilter !== 'all' && (
                          <button 
                            onClick={() => setPaymentStatusFilter('all')}
                            className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Show all payments
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPaymentResponses.map(payment => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getShopNameById(payment.shopId)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.submittedAt?.toDate 
                            ? payment.submittedAt.toDate().toLocaleDateString() 
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ৳{payment.amount}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPaymentMethodBadge(payment)}
                        <div className="text-xs text-gray-500 mt-1">
                          {payment.transactionId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2 justify-end">
                          <button
                            onClick={() => openPaymentDetailsModal(payment)}
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </button>
                          
                          {payment.status === 'pending' && (
                            <>
                              <button
                                onClick={() => confirmPaymentResponse(payment.id)}
                                className="text-green-600 hover:text-green-900 flex items-center"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirm
                              </button>
                              <button
                                onClick={() => rejectPaymentResponse(payment.id)}
                                className="text-red-600 hover:text-red-900 flex items-center"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShopApprovalManager;