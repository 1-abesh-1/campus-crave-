import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { FcGoogle } from 'react-icons/fc'; // You'll need to install react-icons if not already installed

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await login(email, password);
      toast.success('Successfully logged in!');
      navigate('/dashboard');
    } catch (error) {
      if (error.message && error.message.includes('Email not verified')) {
        toast.error('Your email is not verified. A new verification email has been sent.');
      } else {
        toast.error('Failed to log in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      toast.success('Successfully logged in with Google!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to log in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      return toast.error('Please enter your email address first');
    }

    try {
      setLoading(true);
      await resetPassword(email);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error) {
      toast.error('Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-6 card">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Sign in to your account
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
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-blue-600 hover:text-blue-500 focus:outline-none"
                  style={{ color: '#414833' }}
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </div>

          <button
            style={{ backgroundColor: '#4a4e69', color: 'white' }}
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
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
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <FcGoogle className="text-xl" />
            Sign in with Google
          </button>

          <div className="text-center mt-4" >
            <Link to="/register" className="text-blue-600 hover:text-blue-500" style={{  color: '#414833' }}>
              Don't have an account? Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;