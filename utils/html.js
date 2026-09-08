
import React from 'react';
import htm from 'htm';

const createElement = React.createElement || (React && React.default && React.default.createElement);

if (!createElement) {
  console.error("React.createElement not found.");
  throw new Error("React initialization failed");
}

const htmFn = (htm && typeof htm.bind === 'function') ? htm : (htm && htm.default);

if (!htmFn || typeof htmFn.bind !== 'function') {
  console.error("htm module structure:", htm);
  throw new Error("htm initialization failed");
}

// Bind htm to React.createElement to produce tagged template function
const html = htmFn.bind(createElement);

export { html };


