import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Search,
  RefreshCw
} from 'lucide-react';

function PaymentStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('month');
  const [expandedSection, setExpandedSection] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [paymentData, setPaymentData] = useState([]);
  const [stats, setStats] = useState({
    totalPayments: 0,
    confirmedPayments: 0,
    pendingPayments: 0,
    totalAmount: 0,
    totalAdminFees: 0,
    totalDriverEarnings: 0,
    averagePayment: 0
  });
  const [dailyStats, setDailyStats] = useState([]);
  const [driverSummaries, setDriverSummaries] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchPaymentData();
    const unsubscribe = setupRealTimeListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [dateRange]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredData(paymentData);
    } else {
      const lowercasedSearch = searchTerm.toLowerCase();
      const filtered = paymentData.filter(payment => 
        payment.id.toLowerCase().includes(lowercasedSearch) ||
        payment.orderId.toLowerCase().includes(lowercasedSearch) ||
        (payment.customerEmail && payment.customerEmail.toLowerCase().includes(lowercasedSearch)) ||
        (payment.driverEmail && payment.driverEmail.toLowerCase().includes(lowercasedSearch)) ||
        payment.status.toLowerCase().includes(lowercasedSearch)
      );
      setFilteredData(filtered);
    }
  }, [searchTerm, paymentData]);

  const setupRealTimeListener = () => {
    try {
      const startDate = getStartDate();
      const startTimestamp = Timestamp.fromDate(startDate);
      
      const ordersQuery = query(
        collection(db, 'orders'),
        where('createdAt', '>=', startTimestamp)
      );

      return onSnapshot(ordersQuery, (snapshot) => {
        processOrderData(snapshot.docs);
      }, (error) => {
        console.error('Error in real-time listener:', error);
        setError(error.message);
      });
    } catch (error) {
      console.error('Error setting up real-time listener:', error);
      setError(error.message);
      return null;
    }
  };

  const getStartDate = () => {
    const now = new Date();
    const startDate = new Date();
    
    if (dateRange === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (dateRange === 'month') {
      startDate.setMonth(now.getMonth());
      startDate.setDate(1);
    } else if (dateRange === 'quarter') {
      startDate.setMonth(Math.floor(now.getMonth() / 3) * 3);
      startDate.setDate(1);
    } else if (dateRange === 'year') {
      startDate.setMonth(0);
      startDate.setDate(1);
    }
    
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  };

  const formatDate = (date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setLoading(true);
  };

  const processOrderData = (docs) => {
    const startDate = getStartDate();
    const payments = [];
    const dailyData = {};
    const driverData = {};
    
    docs.forEach(doc => {
      const order = doc.data();
      
      if (!order.deliveryCharge) return;
      
      let orderDate;
      if (order.createdAt instanceof Timestamp) {
        orderDate = order.createdAt.toDate();
      } else if (typeof order.createdAt === 'string') {
        orderDate = new Date(order.createdAt);
      } else if (order.createdAt && order.createdAt.seconds) {
        orderDate = new Date(order.createdAt.seconds * 1000);
      } else {
        orderDate = new Date();
      }
      
      if (orderDate >= startDate) {
        const deliveryFee = Number(order.deliveryCharge) || 0;
        const adminFee = deliveryFee * 0.2;
        const driverEarnings = deliveryFee * 0.8;
        
        const paymentStatus = order.adminPaymentConfirmed ? 'confirmed' : 
                            order.paymentListed ? 'pending' : 'unlisted';
        
        const payment = {
          id: doc.id,
          amount: Number(order.total) || 0,
          deliveryFee,
          adminFee,
          driverEarnings,
          customerEmail: order.customerEmail || '',
          driverEmail: order.deliveryPersonMail || '',
          date: orderDate,
          status: paymentStatus,
          orderId: doc.id
        };
        
        payments.push(payment);
        
        const dateKey = orderDate.toLocaleDateString();
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = {
            date: dateKey,
            formattedDate: formatDate(orderDate),
            totalAmount: 0,
            adminFees: 0,
            driverEarnings: 0,
            paymentCount: 0
          };
        }
        
        dailyData[dateKey].totalAmount += payment.amount;
        dailyData[dateKey].adminFees += payment.adminFee;
        dailyData[dateKey].driverEarnings += payment.driverEarnings;
        dailyData[dateKey].paymentCount += 1;
        
        if (payment.driverEmail) {
          if (!driverData[payment.driverEmail]) {
            driverData[payment.driverEmail] = {
              email: payment.driverEmail,
              totalEarnings: 0,
              paymentCount: 0,
              paidAmount: 0,
              pendingAmount: 0
            };
          }
          
          driverData[payment.driverEmail].totalEarnings += payment.driverEarnings;
          driverData[payment.driverEmail].paymentCount += 1;
          
          if (payment.status === 'confirmed') {
            driverData[payment.driverEmail].paidAmount += payment.driverEarnings;
          } else {
            driverData[payment.driverEmail].pendingAmount += payment.driverEarnings;
          }
        }
      }
    });
    
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalAdminFees = payments.reduce((sum, payment) => sum + payment.adminFee, 0);
    const totalDriverEarnings = payments.reduce((sum, payment) => sum + payment.driverEarnings, 0);
    const confirmedPayments = payments.filter(payment => payment.status === 'confirmed').length;
    const pendingPayments = payments.filter(payment => payment.status === 'pending').length;
    
    const paymentStats = {
      totalPayments: payments.length,
      confirmedPayments,
      pendingPayments,
      totalAmount,
      totalAdminFees,
      totalDriverEarnings,
      averagePayment: payments.length > 0 ? totalAmount / payments.length : 0
    };
    
    const dailyStatsArray = Object.values(dailyData).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const driverSummariesArray = Object.values(driverData).sort((a, b) => 
      b.totalEarnings - a.totalEarnings
    );
    
    setPaymentData(payments);
    setFilteredData(payments);
    setStats(paymentStats);
    setDailyStats(dailyStatsArray);
    setDriverSummaries(driverSummariesArray);
    setLoading(false);
    setIsRefreshing(false);
  };

  const fetchPaymentData = async () => {
    try {
      setIsRefreshing(true);
      const startDate = getStartDate();
      const startTimestamp = Timestamp.fromDate(startDate);
      
      const ordersQuery = query(
        collection(db, 'orders'),
        where('createdAt', '>=', startTimestamp)
      );

      console.log('Fetching payment data...', {
        dateRange,
        startDate: startDate.toISOString(),
        collection: 'orders'
      });

      const orderSnapshot = await getDocs(ordersQuery);
      
      if (orderSnapshot.empty) {
        console.log('No payment data found');
      } else {
        console.log(`Found ${orderSnapshot.size} orders`);
      }
      
      processOrderData(orderSnapshot.docs);
      
    } catch (error) {
      console.error('Error fetching payment data:', error);
      setError(error.message);
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchPaymentData();
  };

  const formatCurrency = (amount) => {
    return `৳${amount.toFixed(2)}`;
  };

  const formatPercent = (value, total) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  if (loading && !isRefreshing) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment data...</p>
        </div>
      </div>
    );
  }

  if (error && !isRefreshing) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
        <p className="text-red-600 font-medium">Error: {error}</p>
        <button 
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onClick={handleRefresh}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center mb-4 md:mb-0">
          <h2 className="text-2xl font-bold text-gray-800">Payment Statistics</h2>
          <button 
            onClick={handleRefresh}
            className={`ml-3 p-2 text-blue-500 rounded-full hover:bg-blue-50 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
            disabled={isRefreshing}
            aria-label="Refresh data"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search payments..."
              className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none w-full sm:w-56"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>
          
          <div className="flex items-center bg-white border rounded-lg shadow-sm">
            <Calendar className="ml-3 text-gray-500" size={18} />
            <select
              className="px-3 py-2 bg-transparent focus:outline-none cursor-pointer"
              value={dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
            >
              <option value="week">Last 7 days</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Overview Section */}
      <div className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer border-b hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('overview')}
        >
          <div className="flex items-center">
            <DollarSign className="text-blue-500 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-800">Payment Overview</h3>
          </div>
          {expandedSection === 'overview' ? 
            <ChevronUp className="text-gray-600" size={20} /> : 
            <ChevronDown className="text-gray-600" size={20} />
          }
        </div>
        
        {expandedSection === 'overview' && (
          <div className="p-4 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="text-sm font-medium text-blue-800 mb-1">Total Payments</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(stats.totalAmount)}
                </p>
                <p className="text-xs text-blue-500 mt-1">
                  From {stats.totalPayments} orders
                </p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h4 className="text-sm font-medium text-green-800 mb-1">Admin Earnings</h4>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.totalAdminFees)}
                </p>
                <p className="text-xs text-green-500 mt-1">
                  {formatPercent(stats.totalAdminFees, stats.totalAmount)} of total revenue
                </p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <h4 className="text-sm font-medium text-purple-800 mb-1">Driver Earnings</h4>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(stats.totalDriverEarnings)}
                </p>
                <p className="text-xs text-purple-500 mt-1">
                  {formatPercent(stats.totalDriverEarnings, stats.totalAmount)} of total revenue
                </p>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                <h4 className="text-sm font-medium text-amber-800 mb-1">Payment Status</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">
                      Confirmed: {stats.confirmedPayments}
                    </p>
                    <p className="text-sm text-amber-600 font-medium">
                      Pending: {stats.pendingPayments}
                    </p>
                  </div>
                  <div className="w-10 h-10 relative">
                    <div className="w-10 h-10 rounded-full border-4 border-amber-200">
                      <div 
                        className="absolute inset-0 border-4 border-green-400 rounded-full"
                        style={{
                          clipPath: stats.totalPayments > 0 
                            ? `inset(0 ${100 - (stats.confirmedPayments / stats.totalPayments * 100)}% 0 0)` 
                            : 'inset(0 100% 0 0)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Daily Trends Section */}
      <div className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer border-b hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('trends')}
        >
          <div className="flex items-center">
            <TrendingUp className="text-green-500 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-800">Payment Trends</h3>
          </div>
          {expandedSection === 'trends' ? 
            <ChevronUp className="text-gray-600" size={20} /> : 
            <ChevronDown className="text-gray-600" size={20} />
          }
        </div>
        
        {expandedSection === 'trends' && (
          <div className="p-4 animate-fadeIn">
            {dailyStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Admin Fees
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Driver Earnings
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailyStats.map((day, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {day.formattedDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatCurrency(day.totalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(day.adminFees)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(day.driverEarnings)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {day.paymentCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </td>
                      <td className="px-6 py-3 text-left text-xs font-medium text-gray-900">
                        {formatCurrency(dailyStats.reduce((sum, day) => sum + day.totalAmount, 0))}
                      </td>
                      <td className="px-6 py-3 text-left text-xs font-medium text-gray-900">
                        {formatCurrency(dailyStats.reduce((sum, day) => sum + day.adminFees, 0))}
                      </td>
                      <td className="px-6 py-3 text-left text-xs font-medium text-gray-900">
                        {formatCurrency(dailyStats.reduce((sum, day) => sum + day.driverEarnings, 0))}
                      </td>
                      <td className="px-6 py-3 text-left text-xs font-medium text-gray-900">
                        {dailyStats.reduce((sum, day) => sum + day.paymentCount, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-gray-500">
                No payment data available for the selected period
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Driver Earnings Section */}
      <div className="mb-6 bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer border-b hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('drivers')}
        >
          <div className="flex items-center">
            <Users className="text-purple-500 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-800">Driver Payments</h3>
          </div>
          {expandedSection === 'drivers' ? 
            <ChevronUp className="text-gray-600" size={20} /> : 
            <ChevronDown className="text-gray-600" size={20} />
          }
        </div>
        
        {expandedSection === 'drivers' && (
          <div className="p-4 animate-fadeIn">
            {driverSummaries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Driver
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Earnings
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paid
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Orders
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {driverSummaries.map((driver, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {driver.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatCurrency(driver.totalEarnings)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                          {formatCurrency(driver.paidAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600">
                          {formatCurrency(driver.pendingAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {driver.paymentCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-gray-500">
                No driver payment data available for the selected period
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Recent Payments Section */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200">
        <div 
          className="flex justify-between items-center p-4 cursor-pointer border-b hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('recent')}
        >
          <div className="flex items-center">
            <DollarSign className="text-amber-500 mr-2" size={20} />
            <h3 className="text-lg font-semibold text-gray-800">Recent Payments</h3>
          </div>
          {expandedSection === 'recent' ? 
            <ChevronUp className="text-gray-600" size={20} /> : 
            <ChevronDown className="text-gray-600" size={20} />
          }
        </div>
        
        {expandedSection === 'recent' && (
          <div className="p-4 animate-fadeIn">
            {filteredData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6  py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Admin Fee
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Driver
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.slice(0, 10).map((payment, index) => {
                      let formattedDate;
                      try {
                        const dateObj = payment.date instanceof Timestamp 
                          ? payment.date.toDate() 
                          : new Date(payment.date);
                        
                        formattedDate = dateObj.toLocaleDateString(undefined, {
                          year: '2-digit',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                      } catch (error) {
                        formattedDate = 'Invalid date';
                      }
                      
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {payment.orderId.slice(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(payment.adminFee)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payment.driverEmail || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                              ${payment.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                                payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-gray-100 text-gray-800'}`}>
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formattedDate}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {filteredData.length > 10 && (
                  <div className="py-3 px-6 border-t">
                    <p className="text-sm text-gray-500">
                      Showing 10 of {filteredData.length} payments
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-gray-500">
                No payment data available for the selected period
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add CSS for animations */}
      <style jsx="true">{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default PaymentStats;