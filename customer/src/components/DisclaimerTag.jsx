import React from 'react';

const DisclaimerTag = ({panel}) => {
 
  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md shadow-sm space-y-2">
    {panel?<ul className="list-disc pl-5 text-sm font-medium">
      <li className="font-normal">
          Delivery persons are strictly prohibited from delivering any orders to university library or labs.
        </li>
        <li className="font-normal">
          If a delivery is made to any lab or library, actions will be taken against the associated account and persons.
        </li>
      </ul>:<ul className="list-disc pl-5 text-sm font-medium">
        <li className="font-normal">
          Do not order food to the library or labs. Bringing any kind of food into labs or library is strictly forbidden.
        </li>
        <li className="font-normal">
          Actions will be taken against anyone associated with food orders made to labs or library.
        </li>
      </ul>}
    </div>
  );
};

export default DisclaimerTag;


