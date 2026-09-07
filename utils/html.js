
import React from 'react';
import htm from 'htm';

const createElement = React.createElement || (React && React.default && React.default.createElement);

if (!createElement) {
  console.error("React.createElement not found.");
  throw new Error("React initialization failed");
}

const bindFn = typeof htm === 'function' ? htm : (htm && htm.default);

if (typeof bindFn !== 'function') {
  console.error("htm module structure:", htm);
  throw new Error("htm initialization failed");
}

// bindFn(createElement) returns the htm tagged template function bound to React.createElement
const html = bindFn(createElement);

export { html };

