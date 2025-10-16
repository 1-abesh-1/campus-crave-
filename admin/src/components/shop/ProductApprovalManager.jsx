import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, addDoc } from 'firebase/firestore';
import { Package, CheckCircle, XCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

function ProductApprovalManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [debug, setDebug] = useState(null);




  useEffect(() => {
    fetchPendingProducts();
  }, []);

  const fetchPendingProducts = async () => {
    setLoading(true);
    try {
      console.log("Attempting to fetch from productSubmissions collection...");
      
      // First try without filters to see if the collection exists and has documents
      const basicQuery = query(
        collection(db, 'productSubmissions')
      );
      
      const basicSnapshot = await getDocs(basicQuery);
      console.log(`Found ${basicSnapshot.docs.length} total documents in productSubmissions`);
      
      // Now apply the filters
      const productsQuery = query(
        collection(db, 'productSubmissions'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      
      const productsSnapshot = await getDocs(productsQuery);
      console.log(`Found ${productsSnapshot.docs.length} pending products`);
      
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(productsData);
      setDebug({
        totalDocs: basicSnapshot.docs.length,
        pendingDocs: productsSnapshot.docs.length
      });
    } catch (error) {
      console.error('Error fetching pending products:', error);
      setDebug({
        error: error.message,
        code: error.code
      });
      toast.error(`Failed to load pending products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const approveProduct = async (productId) => {
    try {
      // Get the product submission data
      const productToApprove = products.find(product => product.id === productId);
      if (!productToApprove) {
        throw new Error('Product not found');
      }

      // Update status in productSubmissions
      await updateDoc(doc(db, 'productSubmissions', productId), {
        status: 'approved'
      });
      
      // Create a new document in the products collection
      const { id, status, ...productData } = productToApprove;
      await addDoc(collection(db, 'products'), {
        ...productData,
        status: 'active',
        approvedAt: new Date(),
        originalSubmissionId: productId
      });
      
      toast.success('Product approved and added to marketplace');
      
      // Update local state
      setProducts(prev => prev.filter(product => product.id !== productId));
      
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
        setIsDetailsModalOpen(false);
      }
    } catch (error) {
      console.error('Error approving product:', error);
      toast.error('Failed to approve product: ' + error.message);
    }
  };

  const rejectProduct = async (productId) => {
    try {
      // Update status in productSubmissions (not products)
      await updateDoc(doc(db, 'productSubmissions', productId), {
        status: 'rejected',
        rejectedAt: new Date()
      });
      
      toast.success('Product rejected');
      
      // Update local state
      setProducts(prev => prev.filter(product => product.id !== productId));
      
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
        setIsDetailsModalOpen(false);
      }
    } catch (error) {
      console.error('Error rejecting product:', error);
      toast.error('Failed to reject product: ' + error.message);
    }
  };

  const openDetailsModal = (product) => {
    setSelectedProduct(product);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedProduct(null);
  };

  // Bypass filters if we're having trouble getting products
  const fetchAllProducts = async () => {
    try {
      const basicQuery = query(
        collection(db, 'productSubmissions')
      );
      
      const basicSnapshot = await getDocs(basicQuery);
      const productsData = basicSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(productsData);
      toast.success(`Loaded ${productsData.length} products without filters`);
    } catch (error) {
      console.error('Error in bypass fetch:', error);
      toast.error('Still failed to load products: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#656d4a]"></div>
        <p className="mt-2 text-gray-500">Loading pending products...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">Product Approval Requests</h3>
      

      
      {products.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No pending product approval requests</p>
          <button 
            onClick={fetchPendingProducts}
            className="mt-4 px-4 py-2 bg-[#656d4a] text-white rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map(product => (
            <div key={product.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div className="flex items-start space-x-3 mb-4 md:mb-0">
                  <div className="h-16 w-16 flex-shrink-0 bg-[#f8f9fa] rounded-lg overflow-hidden flex items-center justify-center">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-8 w-8 text-[#656d4a]" />
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-semibold">{product.name}</h4>
                    <p className="text-sm text-gray-600">Shop: {product.shopName || 'Unknown'}</p>
                    <p className="text-sm text-gray-600">Price: ${product.price?.toFixed(2) || '0.00'}</p>
                    <p className="text-sm text-gray-600">Category: {product.category || 'Uncategorized'}</p>
                    <p className="text-sm text-gray-600">Status: {product.status || 'Unknown'}</p>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => openDetailsModal(product)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Details
                  </button>
                  <button
                    onClick={() => approveProduct(product.id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </button>
                  <button
                    onClick={() => rejectProduct(product.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Product Details Modal */}
      {isDetailsModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">Product Details</h3>
                <button 
                  onClick={closeDetailsModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  &times;
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  {/* Product Image */}
                  <div className="rounded-lg overflow-hidden bg-[#f8f9fa] mb-4">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-full h-64 object-cover"
                      />
                    ) : (
                      <div className="w-full h-64 flex items-center justify-center bg-[#e9edc9]">
                        <Package className="h-16 w-16 text-[#656d4a]" />
                      </div>
                    )}
                  </div>
                  
                  {/* Shop Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-700 mb-2">Shop Information</h4>
                    <p className="text-sm">
                      <span className="font-medium">Shop:</span> {selectedProduct.shopName || 'Unknown'}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">Shop ID:</span> {selectedProduct.shopId || 'Unknown'}
                    </p>
                    <p className="text-sm mt-1">
                      <span className="font-medium">Status:</span> {selectedProduct.status || 'Unknown'}
                    </p>
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <h4 className="text-lg font-semibold">{selectedProduct.name}</h4>
                  
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="bg-[#e9edc9] px-3 py-1 rounded-full text-sm text-[#656d4a]">
                      {selectedProduct.category || 'Uncategorized'}
                    </div>
                    <div className="bg-[#e9edc9] px-3 py-1 rounded-full text-sm text-[#656d4a]">
                      Price: ${selectedProduct.price?.toFixed(2) || '0.00'}
                    </div>
                    <div className="bg-[#e9edc9] px-3 py-1 rounded-full text-sm text-[#656d4a]">
                      Delivery: ${selectedProduct.deliveryCharge?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700">Description</h5>
                    <p className="text-gray-600 mt-1 whitespace-pre-line">
                      {selectedProduct.description || 'No description provided'}
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <h5 className="font-medium text-gray-700">Delivery Options</h5>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedProduct.selfDelivery && (
                        <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-sm">
                          Self-delivery (by shop)
                        </span>
                      )}
                      {selectedProduct.platformDelivery && (
                        <span className="bg-[#e9edc9] text-[#656d4a] px-2 py-0.5 rounded text-sm">
                          Platform delivery
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                      onClick={closeDetailsModal}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => rejectProduct(selectedProduct.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </button>
                    <button
                      onClick={() => approveProduct(selectedProduct.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductApprovalManager;