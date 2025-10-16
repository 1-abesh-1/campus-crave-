import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

function ProductApprovalManager() {
  const [pendingProducts, setPendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchPendingProducts();
  }, []);

  const fetchPendingProducts = async () => {
    try {
      const pendingQuery = query(
        collection(db, 'productSubmissions'),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(pendingQuery);
      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setPendingProducts(products);
    } catch (error) {
      console.error('Error fetching pending products:', error);
      toast.error('Failed to load pending products');
    } finally {
      setLoading(false);
    }
  };

  const approveProduct = async (product) => {
    try {
      // Add to approved products collection
      await addDoc(collection(db, 'products'), {
        name: product.name,
        price: parseFloat(product.price),
        category: product.category,
        imageUrl: product.imageUrl,
        location: product.location,
        deliveryCharge: parseFloat(product.deliveryCharge),
        description: product.description,
        selfDelivery: product.selfDelivery,
        sellerId: product.sellerId,
        sellerEmail: product.sellerEmail,
        approvedAt: new Date()
      });
      
      // Update submission status
      const submissionRef = doc(db, 'productSubmissions', product.id);
      await updateDoc(submissionRef, { status: 'approved' });
      
      toast.success('Product approved successfully!');
      fetchPendingProducts();
    } catch (error) {
      console.error('Error approving product:', error);
      toast.error('Failed to approve product');
    }
  };

  const openRejectModal = (product) => {
    setSelectedProduct(product);
    setRejectionReason('');
  };

  const rejectProduct = async () => {
    if (!selectedProduct) return;
    
    try {
      const submissionRef = doc(db, 'productSubmissions', selectedProduct.id);
      await updateDoc(submissionRef, { 
        status: 'rejected',
        rejectionReason: rejectionReason
      });
      
      toast.success('Product rejected');
      setSelectedProduct(null);
      fetchPendingProducts();
    } catch (error) {
      console.error('Error rejecting product:', error);
      toast.error('Failed to reject product');
    }
  };

  const deleteSubmission = async (productId) => {
    try {
      await deleteDoc(doc(db, 'productSubmissions', productId));
      toast.success('Submission deleted successfully');
      fetchPendingProducts();
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast.error('Failed to delete submission');
    }
  };

  const filteredProducts = pendingProducts.filter(product => {
    return (
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sellerEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return <div>Loading pending product submissions...</div>;
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Product Approval Queue</h2>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, category, or seller email..."
          className="input w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="space-y-4">
        {filteredProducts.length === 0 ? (
          <p className="text-gray-500">No pending product submissions</p>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{product.name}</h3>
                  <p className="text-sm text-gray-500">${product.price} - {product.category}</p>
                  <p className="text-xs text-gray-500">Seller: {product.sellerEmail}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => approveProduct(product)}
                    className="btn bg-green-500 hover:bg-green-600 text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(product)}
                    className="btn bg-red-500 hover:bg-red-600 text-white"
                  >
                    Reject
                  </button>
                </div>
              </div>
              
              <div className="mt-2 space-y-2">
                {product.description && (
                  <p className="text-sm">{product.description}</p>
                )}
                <div className="text-sm">
                  <p><span className="font-medium">Delivery:</span> {product.selfDelivery ? 'Self Delivery' : 'Platform Delivery'}</p>
                  <p><span className="font-medium">Pickup Location:</span> {product.location}</p>
                  <p><span className="font-medium">Delivery Charge:</span> ${product.deliveryCharge}</p>
                </div>
                
                <div className="mt-2">
                  {product.imageUrl && (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="h-20 w-20 object-cover rounded"
                    />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Reject Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Reject Product: {selectedProduct.name}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Rejection Reason
              </label>
              <textarea
                className="input mt-1"
                rows="3"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide reason for rejection"
                required
              ></textarea>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedProduct(null)}
                className="btn bg-gray-200 hover:bg-gray-300 text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={rejectProduct}
                className="btn bg-red-500 hover:bg-red-600 text-white"
                disabled={!rejectionReason.trim()}
              >
                Reject Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductApprovalManager;