import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DisclaimerTag from '../pages/DisclaimerTag';
function Landing() {
  const { currentUser } = useAuth();
  
  // If user is already logged in, redirect to dashboard
  if (currentUser) {
    return <Navigate to="/dashboard" />;
  }
  
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
          CampusCrave – Food Delivery at BRAC University
            <span className="block" style={{  color: '#7f4f24' }}>Right to You</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Whether you're in class, at the library, or anywhere on campus, we’ve got your cravings covered.</p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <Link style={{ backgroundColor: '#4a4e69', color: 'white' }} to="/register" className="btn btn-primary text-lg px-8 py-3">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;