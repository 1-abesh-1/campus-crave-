import React, { useState } from 'react';
import { DollarSign, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

function ShopPaymentStatus({ shop,refetchShop }) {
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    paymentMethod: 'bkash',
    phoneNumber: '',
    transactionId: ''
  });

  const handleFormChange = (e) => {
    setPaymentFormData({
      ...paymentFormData,
      [e.target.name]: e.target.value
    });
  };

  const handlePaymentSubmission = async (e) => {
    e.preventDefault();
  
    try {
      const { paymentMethod, phoneNumber, transactionId } = paymentFormData;
      if (!phoneNumber || !transactionId) {
        toast.error('Please fill in all required fields');
        return;
      }
  
      const shopRef = doc(db, 'shops', shop.id);
  
      // 1. Mark payment form as submitted on the shop
      await updateDoc(shopRef, {
        'utilityFeePayment.paymentFormSubmitted': true,
      });
  
      // 2. Create a payment response entry
      await addDoc(collection(db, 'paymentResponses'), {
        shopId: shop.id,
        shopName: shop.name,
        paymentMethod,
        phoneNumber,
        transactionId,
        status: 'pending',
        submittedAt: serverTimestamp(),
      });
  refetchShop?.();
      toast.success('Payment details submitted successfully');
      setIsFormModalOpen(false);
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Failed to submit payment details');
    }
  };

  if (!shop?.utilityFeePayment) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-semibold mb-4">Utility Fee Payment Status</h3>
      <span className='text-blue-500'>You need to pay the utility fee every month to keep your shop active. If you are no longer managing your shop, you don't need to pay. Approval will be automatically removed.</span>
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-gray-600">Payment Amount:</span>
            <span className="ml-2 font-semibold">৳{shop.utilityFeePayment.paymentDetails?.amount || 0}</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm ${
            shop.utilityFeePayment.adminPaymentConfirmed 
              ? 'bg-green-100 text-green-800' 
              : shop.utilityFeePayment.paymentFormSubmitted 
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {shop.utilityFeePayment.adminPaymentConfirmed 
              ? 'confirmed' 
              : shop.utilityFeePayment.paymentFormSubmitted 
                ? 'Submitted'
                : 'pending'}
          </span>
        </div>

        {shop.utilityFeePayment.paymentDetails && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium text-gray-700">Payment Methods:</h4>
            {shop.utilityFeePayment.paymentDetails.bkashNumber && (
              <p className="text-sm">bKash: {shop.utilityFeePayment.paymentDetails.bkashNumber}</p>
            )}
            {shop.utilityFeePayment.paymentDetails.nagadNumber && (
              <p className="text-sm">Nagad: {shop.utilityFeePayment.paymentDetails.nagadNumber}</p>
            )}
            {shop.utilityFeePayment.paymentDetails.rocketNumber && (
              <p className="text-sm">Rocket: {shop.utilityFeePayment.paymentDetails.rocketNumber}</p>
            )}
            {shop.utilityFeePayment.paymentDetails.note && (
              <p className="text-sm text-gray-600 italic">Note: {shop.utilityFeePayment.paymentDetails.note}</p>
            )}
          </div>
        )}

        {!shop.utilityFeePayment.paymentFormSubmitted && !shop.utilityFeePayment.adminPaymentConfirmed && (
          <div className="mt-4">
            <button
              onClick={() => setIsFormModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              
              Submit Payment Details
            </button>
          </div>
        )}

        {shop.utilityFeePayment.paymentFormSubmitted && !shop.utilityFeePayment.adminPaymentConfirmed && (
          <div className="mt-4 flex items-center text-blue-600">
            <CheckCircle className="w-4 h-4 mr-2" />
            <span>Payment details submitted. Waiting for admin confirmation.</span>
          </div>
        )}
      </div>

      {/* Payment Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Submit Payment Details</h3>
            
            <form onSubmit={handlePaymentSubmission}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Amount to Pay:</label>
                <div className="font-bold text-lg">৳{shop.utilityFeePayment.paymentDetails?.amount || 0}</div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Payment Method:</label>
                <select
                  name="paymentMethod"
                  value={paymentFormData.paymentMethod}
                  onChange={handleFormChange}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Phone Number:</label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={paymentFormData.phoneNumber}
                  onChange={handleFormChange}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter your phone number"
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

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
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

export default ShopPaymentStatus;