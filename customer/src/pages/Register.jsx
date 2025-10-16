import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase'; // Import auth from firebase
import { signOut } from 'firebase/auth'; // Import signOut function
import toast from 'react-hot-toast';
import { FcGoogle } from 'react-icons/fc';
import RegistrationSuccess from './Registrationsuccess';
import DisclaimerTag from '../pages/DisclaimerTag';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { signup, signInWithGoogle, sendVerificationEmail } = useAuth();
  const navigate = useNavigate();

  // Array of allowed email domains
  const allowedDomains = [
    '@g.bracu.ac.bd',
    // Add more allowed domains here in the future as needed
    // Example: '@faculty.bracu.ac.bd',
    // Example: '@student.bracu.ac.bd',
  ];
  
  // Function to check if email is from an allowed domain
  const isAllowedEmail = (email) => {
    if (!email) return false;
    return allowedDomains.some(domain => email.toLowerCase().endsWith(domain));
  };
  
  // Function to check if email is from a temporary email service
  const isTempEmail = (email) => {
    const tempEmailDomains = [
      'temp-mail.org', 'tempmail.com', 'guerrillamail.com', 'mailinator.com', 
      'getairmail.com', 'yopmail.com', '10minutemail.com', 'mintemail.com',
      'tempmail.plus', 'throwawaymail.com', 'emailondeck.com', 'tempinbox.com',
      'mailnesia.com', 'maildrop.cc', 'fakeinbox.com', 'tempail.com',
      'dispostable.com', 'sharklasers.com', 'trashmail.com', 'dropmail.me',
      'tempr.email', '10mail.org', 'spamgourmet.com', 'getnada.com',
      'mohmal.com', 'temp-mails.com', 'emailtemp.org', 'tempmailaddress.com'
    ];
    
    // Extract domain from email
    const domain = email.split('@')[1]?.toLowerCase();
    return tempEmailDomains.includes(domain);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!acceptedTerms) {
      return toast.error('You must accept the Terms and Conditions to create an account');
    }

    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    
    // Check if the email is from a temporary email service
    if (isTempEmail(email)) {
      return toast.error('Temporary email addresses are not allowed. Please use a permanent email address.');
    }

    // Check if the email is from an allowed domain
    if (!isAllowedEmail(email)) {
      return toast.error('Registration is only available for authorized university email addresses');
    }

    try {
      setLoading(true);
      // Create the user in Firebase Auth
      const userCredential = await signup(email, password);
      
      // Send verification email
      await sendVerificationEmail(userCredential.user);
      
      // Store additional user data in Firestore
      const userId = userCredential.user.uid;
      await setDoc(doc(db, 'users', userId), {
        email: email,
        admin: false,
        delivery: true, // All users will have delivery privileges since they all have BRACU emails
        emailVerified: false, // Track verification status
        createdAt: new Date().toISOString(),
        termsAccepted: true, // Record that the user accepted terms
        termsAcceptedDate: new Date().toISOString() // Record when they accepted
      });
      
      // Sign out the user since we require email verification
      await signOut(auth);
      
      // Store the registered email and show success screen
      setRegisteredEmail(email);
      setRegistrationComplete(true);
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to create an account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!acceptedTerms) {
      return toast.error('You must accept the Terms and Conditions to create an account');
    }
    
    try {
      setLoading(true);
      const userCredential = await signInWithGoogle();
      
      const userId = userCredential.user.uid;
      const userEmail = userCredential.user.email;
      
      // Check if the email is from a temporary email service
      if (isTempEmail(userEmail)) {
        // Sign out and show error
        await signOut(auth);
        toast.error('Temporary email addresses are not allowed. Please use a permanent email address.');
        setLoading(false);
        return;
      }
      
      // Check if the email is from an allowed domain
      if (!isAllowedEmail(userEmail)) {
        // Sign out and show error
        await signOut(auth);
        toast.error('Registration is only available for authorized university email addresses');
        setLoading(false);
        return;
      }
      
      const isVerified = userCredential.user.emailVerified;
  
      // Create a user object
      const userData = {
        email: userEmail,
        admin: false,
        delivery: true, // All users will have delivery privileges since they all have BRACU emails
        emailVerified: isVerified, // Google accounts are usually pre-verified
        createdAt: new Date().toISOString(),
        termsAccepted: true, // Record that the user accepted terms
        termsAcceptedDate: new Date().toISOString() // Record when they accepted
      };
  
      await setDoc(doc(db, 'users', userId), userData, { merge: true });
      
      // If not verified (unusual for Google, but possible), send verification and sign out
      if (!isVerified) {
        await sendVerificationEmail(userCredential.user);
        await signOut(auth);
        // Store the registered email and show success screen
        setRegisteredEmail(userEmail);
        setRegistrationComplete(true);
        return;
      }
  
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
    <>
      {registrationComplete ? (
        <RegistrationSuccess email={registeredEmail} />
      ) : (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center "> <div className="max-w-md w-full space-y-8 p-6 card">
            <div>
              <h2 className="text-center text-3xl font-bold text-gray-900 mt-[50px] ">
                Create your account
              </h2>
              <p className="text-center text-sm text-gray-600 mt-2">
                Only authorized university email addresses are accepted
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    University Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="input mt-1"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.name@g.bracu.ac.bd"
                  />
                  {email && !isAllowedEmail(email) && (
                    <p className="text-sm text-red-600 mt-1">
                      Only authorized university email addresses are allowed.
                    </p>
                  )}
                  {email && isAllowedEmail(email) && (
                    <p className="text-sm text-green-600 mt-1">
                      ✓ Valid university email
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
                
                {/* Terms and Conditions Section */}
                <div className="mt-4 border border-gray-300 rounded-md p-3 bg-gray-50">
                  <div className="max-h-32 overflow-y-auto mb-2 text-xs text-gray-600 p-2 bg-white rounded">
                  
  <h1>CampusCrave – Terms and Conditions</h1>
  

  <p>Welcome to <strong>CampusCrave</strong>. By using our website and delivery services, you agree to the following Terms and Conditions. Please read them carefully before placing an order.</p>

  <h2>1. Service Overview</h2>
  <p>CampusCrave is a campus-based delivery coordination platform. We help connect students and campus residents to local food and product vendors by providing on-demand delivery within the university area.</p>
  <p>We are <strong>not the seller or owner</strong> of any food or product listed — our role is solely to facilitate delivery.</p>

  <h2>2. Eligibility</h2>
  <ul>
    <li>Be a student, staff member, or resident of the university campus.</li>
    <li>Provide accurate personal, contact, and delivery information.</li>
    <li>Accept these terms in full.</li>
  </ul>

  <h2>3. Payments</h2>
  <ul>
    <li><strong>Cash on Delivery (COD)</strong> is the standard method for most orders.</li>
    <li>Some orders may require <strong>advance payment</strong>:
      <ul>
        <li>This will be either <strong>clearly written on the product listing</strong>, or</li>
        <li>The <strong>delivery person will inform you before pickup</strong>.</li>
      </ul>
    </li>
    <li>Only shops <strong>affiliated with CampusCrave</strong> guarantee COD — others may require prepayment.</li>
    <li>Prepayments are handled <strong>outside the platform</strong> via bKash, Nagad, or Rocket. CampusCrave <strong>does not offer integrated payment systems</strong>.</li>
    <li><strong>You must pay in full at the time of delivery. Delaying payment is strictly prohibited.</strong></li>
  </ul>

  <h2>4. Delivery Policy</h2>
  <ul>
    <li>Deliveries are limited to the designated university campus area.</li>
    <li>Delivery times may vary depending on vendor readiness, weather, or volume.</li>
    <li>For prepaid orders, delivery personnel are advised to <strong>confirm availability with the shop</strong> before pickup.</li>
    <li>Users must be available at the delivery location at the specified time.</li>
  </ul>

  <h2>5. Cancellations and Refunds</h2>
  <ul>
    <li>Order cancellation is allowed only within the <strong>specified cancellation time</strong> shown during ordering.</li>
    <li>Once an order is <strong>confirmed</strong>, it <strong>cannot be canceled</strong>, especially if prepaid.</li>
    <li>Refunds for prepaid items are issued only if the vendor is unable to fulfill the order.</li>
    <li>CampusCrave is <strong>not responsible for product quality issues</strong>. Report these to the vendor and through our Discord server.</li>
  </ul>

  <h2>6. Food & Product Quality</h2>
  <p>CampusCrave does not cook, prepare, or inspect food or products. We are <strong>not responsible</strong> for freshness, taste, hygiene, or packaging.</p>
  <p>Report product-related issues in our official Discord server.</p>

  <h2>7. Conduct Expectations</h2>
  <ul>
    <li>Treat delivery personnel respectfully.</li>
    <li>Pay promptly and in full.</li>
    <li>Do not engage in fraudulent, abusive, or harassing behavior.</li>
  </ul>

  <h2>8. Reporting Issues</h2>
  <p>All reports regarding products, vendors, or delivery personnel must be submitted via our <strong>official Discord server</strong>.</p>
  <p>We will review each case and take appropriate actions.</p>

  <h2>9. Limitation of Liability</h2>
  <ul>
    <li>CampusCrave is not responsible for food or product quality.</li>
    <li>We are not liable for payment disputes, delivery failures, or vendor misrepresentations.</li>
  </ul>

  <h2>10. Modifications</h2>
  <p>We reserve the right to update these Terms and Conditions at any time. Updates will be posted on our website, and continued use of the service implies agreement.</p>

  <h2>11. Support & Contact</h2>
  <p>For help or to report an issue, please contact us through our official Discord server:</p>
  <p>🔗 <a href="https://discord.com/invite/kGp6885raj" target="_blank" rel="noopener noreferrer">https://discord.com/invite/kGp6885raj</a></p>


                  </div>
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="terms"
                        type="checkbox"
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="terms" className="font-medium text-gray-700">
                        I accept the Terms and Conditions
                      </label>
                    </div>
                  </div>
                </div>
              </div>

<DisclaimerTag/>

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
                  Currently supports: {allowedDomains.join(', ')} domains
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  A verification email will be sent to your email address.
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
      )}
    </>
  );
}

export default Register;