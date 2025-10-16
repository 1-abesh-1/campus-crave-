import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function VerificationReminder() {
  const [loading, setLoading] = useState(false);
  const { currentUser, sendVerificationEmail, logout } = useAuth();
  const navigate = useNavigate();

  const handleResendVerification = async () => {
    if (!currentUser) {
      toast.error('No user is currently logged in');
      return;
    }

    try {
      setLoading(true);
      await sendVerificationEmail(currentUser);
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error('Failed to send verification email. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Email Verification Required</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please verify your email address to continue using our services.
          </p>
          <p className="mt-1 text-sm text-gray-600">
            We've sent a verification link to: <strong>{currentUser?.email}</strong>
          </p>
        </div>

        <div className="flex flex-col space-y-4">
          <button
            onClick={handleResendVerification}
            disabled={loading}
            style={{ backgroundColor: '#4a4e69', color: 'white' }}
            className="py-2 px-4 w-full rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button
            onClick={handleSignOut}
            className="py-2 px-4 w-full border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign Out
          </button>
        </div>

        <div className="mt-6">
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Attention</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    If you don't see the verification email, please check your spam or junk folder.
                    The email will be from the Firebase team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerificationReminder;