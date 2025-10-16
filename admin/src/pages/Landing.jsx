import { Link } from 'react-router-dom';

function Landing() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Campus Food Delivery
            <span className="block text-blue-600">Right to Your Door</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Order food from your favorite campus restaurants and get it delivered quickly.
            Fast, reliable, and convenient delivery service for students.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <Link to="/register" className="btn btn-primary text-lg px-8 py-3">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;