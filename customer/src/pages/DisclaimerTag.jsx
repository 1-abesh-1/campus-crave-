import React from 'react';

const DisclaimerTag = () => {
  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md shadow-sm space-y-2 mb-[50px]">
      <p className="text-sm font-medium">
        Disclaimer: <span className="font-normal">
          This service is not directly affiliated with BRAC University. It is independently managed by a group of students.
        </span>
      </p>
      <ul className="list-disc pl-5 text-sm font-medium">
        <li className="font-normal">
          Do not order food to the library or labs. Bringing any kind of food into labs or libraries is strictly forbidden.
        </li>
        <li className="font-normal">
          Actions will be taken against anyone associated with food orders made to labs or libraries.
        </li>
      </ul>
    </div>
  );
};

export default DisclaimerTag;


