import React from 'react';
import { Link } from 'react-router-dom';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow max-w-md w-full text-center">
        <p className="text-gray-600 mb-4">This page is no longer needed.</p>
        <Link to="/register" className="text-black underline">Go to Register</Link>
      </div>
    </div>
  );
}
