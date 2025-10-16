import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { FcGoogle } from 'react-icons/fc';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Function to check if email is a BRACU GSuite email
  const isBracuEmail = (email) => {
    return email.endsWith('@g.bracu.ac.bd');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    try {
      setLoading(true);
      // Create the user in Firebase Auth
      const userCredential = await signup(email, password);
      
      // Check if email is from BRACU GSuite
      const isDeliveryUser = isBracuEmail(email);
      
      // Store additional user data in Firestore
      const userId = userCredential.user.uid;
      await setDoc(doc(db, 'users', userId), {
        email: email,
        admin: false,
        delivery: isDeliveryUser, // Set delivery to true for BRACU GSuite emails
        createdAt: new Date().toISOString()
      });
      
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to create an account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setLoading(true);
      const userCredential = await signInWithGoogle();
      
      const userId = userCredential.user.uid;
      const userEmail = userCredential.user.email;
      const isDeliveryUser = isBracuEmail(userEmail);
  
      // Create a base user object
      const userData = {
        email: userEmail,
        admin: false,
        createdAt: new Date().toISOString()
      };
  
      // Only add 'delivery' field if it's a BRACU email
      if (isDeliveryUser) {
        userData.delivery = true;
      }
  
      await setDoc(doc(db, 'users', userId), userData, { merge: true });
  
      toast.success('Account created successfully with Google!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Google registration error:', error);
      toast.error('Failed to create an account with Google.');
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-6 card">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                className="input mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {email && isBracuEmail(email) && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ BRACU email detected. You'll get delivery privileges.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                className="input mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                className="input mt-1"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <button
          style={{ backgroundColor: '#4a4e69', color: 'white' }}
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline w-full flex items-center justify-center gap-2"
            onClick={handleGoogleSignUp}
            disabled={loading}
          >
            <FcGoogle className="text-xl" />
            Sign up with Google
          </button>
          
          <div className="text-center mt-2">
            <p className="text-xs text-gray-500">
              BRACU users (@g.bracu.ac.bd) will automatically get delivery privileges.
            </p>
          </div>

          <div className="text-center mt-4">
            <Link to="/login" className="text-blue-600 hover:text-blue-500" style={{  color: '#414833' }}>
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;