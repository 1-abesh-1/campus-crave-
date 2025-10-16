import { useNavigate } from 'react-router-dom';

function RegistrationSuccess({ email }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Registration Successful!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Your account has been created. We've sent a verification email to:
          </p>
          <p className="mt-1 text-center text-lg font-medium text-gray-900">
            {email}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="rounded-md bg-yellow-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Please check your email inbox and click the verification link before logging in.
                    If you don't see the email, please check your spam or junk folder.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2 px-4 text-white font-medium rounded-md"
              style={{ backgroundColor: '#4a4e69' }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegistrationSuccess;